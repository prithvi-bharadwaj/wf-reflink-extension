// Session phases:
//
//   IDLE        — Wispr not in use. Ignore all clipboard activity.
//   COLLECTING  — user is dictating (hotkey held / between toggle presses).
//                 Every clipboard change becomes a queued ref; the transcription
//                 detector is deliberately *not* run here, so a user copy that
//                 happens to contain a trigger phrase can never fire an inject.
//   ARMED       — user released the hotkey. We're waiting for Wispr to write
//                 its transcription. Only the detector runs; non-matching
//                 changes are ignored (no late queue additions).
//
// Transitions:
//   IDLE → COLLECTING   hold:down / first toggle:press (if Wispr is running)
//   COLLECTING → ARMED  hold:up / second toggle:press
//   ARMED → IDLE        detector match (inject fires) OR 15 s timeout

const { clipboard } = require('electron');
const { isRunning } = require('./wispr-process');

const ARM_TIMEOUT_MS = 15_000;

class Session {
  constructor({ queue, detector, replacer, paster, getSettings, onStateChange, onSessionStart }) {
    this.queue = queue;
    this.detector = detector;
    this.replacer = replacer;
    this.paster = paster;
    this.getSettings = getSettings || (() => ({}));
    this.onStateChange = onStateChange || (() => {});
    this.onSessionStart = onSessionStart || (() => {});
    this.active = false;
    this.armed = false;
    this.ignoreNext = false;
    this.armTimer = null;
  }

  async startIfWisprRunning() {
    if (this.active) return;
    if (!(await isRunning())) return;
    // Wipe anything left on the system clipboard (pre-session copies, or
    // residue from a previous session's paster) so it can't get pushed as a
    // stale ref on the very next poll. Then resync the engine's baseline so
    // the cleared state is what we diff against.
    clipboard.clear();
    this.onSessionStart();
    this.queue.clear();
    this.active = true;
    this.armed = false;
    this.ignoreNext = false;
    this._clearArm();
    this.onStateChange();
  }

  arm() {
    if (!this.active) return;
    this.armed = true;
    this._clearArm();
    this.armTimer = setTimeout(() => this._end(), ARM_TIMEOUT_MS);
    this.onStateChange();
  }

  // Toggle: start if idle, else arm for transcription.
  async togglePress() {
    if (!this.active) await this.startIfWisprRunning();
    else this.arm();
  }

  handleClipboardChange(content) {
    if (!this.active) return;
    if (this.ignoreNext) { this.ignoreNext = false; return; }

    if (!this.armed) {
      // COLLECTING: every copy is a ref. Never run detector here.
      this.queue.push(content);
      this.onStateChange();
      return;
    }

    // ARMED: only Wispr's transcription should arrive. Try to match; ignore
    // anything else (a stray copy during the ~1 s we're waiting is almost
    // certainly unintentional).
    const detected = this.detector.check(content, this.queue);
    if (!detected) return;

    const refs = this.queue.getAll();
    const { segments, count } = this.replacer.parse(detected.text, refs);
    if (count > 0) {
      this.ignoreNext = true;
      const { pasteMode, pasteDelayMs } = this.getSettings();
      this.paster.paste({ segments, mode: pasteMode, delayMs: pasteDelayMs });
    }
    this._end();
  }

  _end() {
    this.active = false;
    this.armed = false;
    this.ignoreNext = false;
    this.queue.clear();
    this._clearArm();
    this.onStateChange();
  }

  _clearArm() {
    if (this.armTimer) { clearTimeout(this.armTimer); this.armTimer = null; }
  }
}

module.exports = { Session };
