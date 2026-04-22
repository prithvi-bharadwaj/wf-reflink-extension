const { clipboard } = require('electron');
const { isRunning } = require('./wispr-process');

const ARM_TIMEOUT_MS = 15_000; // max wait for Wispr's transcription after session ends

class Session {
  constructor({ queue, detector, replacer, fallback, onStateChange }) {
    this.queue = queue;
    this.detector = detector;
    this.replacer = replacer;
    this.fallback = fallback;
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
      const processed = this.replacer.process(detected.text, this.queue.getAll());
      if (processed.changed) {
        this.ignoreNext = true;
        clipboard.writeText(processed.text);
        if (processed.images.length > 0) {
          setTimeout(() => this.fallback.pasteImages(processed.images), 300);
        }
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
