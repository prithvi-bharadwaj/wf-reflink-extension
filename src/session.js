const { isRunning } = require('./wispr-process');

const ARM_TIMEOUT_MS = 15_000; // max wait for Wispr's transcription after session ends

class Session {
  constructor({ queue, detector, replacer, paster, getSettings, onStateChange }) {
    this.queue = queue;
    this.detector = detector;
    this.replacer = replacer;
    this.paster = paster;
    this.getSettings = getSettings || (() => ({}));
    this.onStateChange = onStateChange || (() => {});
    this.active = false;
    this.ignoreNext = false;
    this.armTimer = null;
  }

  async startIfWisprRunning() {
    if (this.active) return;
    if (!(await isRunning())) return;
    this.queue.clear();
    this.active = true;
    this._clearArm();
    this.onStateChange();
  }

  arm() {
    if (!this.active) return;
    this._clearArm();
    this.armTimer = setTimeout(() => this._end(), ARM_TIMEOUT_MS);
  }

  // Toggle: start if idle, else arm for transcription.
  async togglePress() {
    if (!this.active) await this.startIfWisprRunning();
    else this.arm();
  }

  handleClipboardChange(content) {
    if (!this.active) return;
    if (this.ignoreNext) { this.ignoreNext = false; return; }

    const detected = this.detector.check(content, this.queue);
    if (detected) {
      const refs = this.queue.getAll();
      const { segments, count } = this.replacer.parse(detected.text, refs);
      if (count > 0) {
        this.ignoreNext = true;
        const { pasteMode, pasteDelayMs } = this.getSettings();
        // fire-and-forget: paster handles engine/key suspension internally
        this.paster.paste({ segments, mode: pasteMode, delayMs: pasteDelayMs });
      }
      this._end();
      return;
    }

    this.queue.push(content);
    this.onStateChange();
  }

  _end() {
    this.active = false;
    this.queue.clear();
    this._clearArm();
    this.onStateChange();
  }

  _clearArm() {
    if (this.armTimer) { clearTimeout(this.armTimer); this.armTimer = null; }
  }
}

module.exports = { Session };
