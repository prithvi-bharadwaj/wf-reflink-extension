const { clipboard } = require('electron');

class ClipboardEngine {
  constructor({ intervalMs = 100, onClipboardChange }) {
    this.intervalMs = intervalMs;
    this.onClipboardChange = onClipboardChange;
    this.timer = null;
    this.lastText = clipboard.readText();
    this.lastImage = clipboard.readImage()?.toDataURL() || '';
  }

  start() {
    this.timer = setInterval(() => this._poll(), this.intervalMs);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  _poll() {
    const text = clipboard.readText();
    const image = clipboard.readImage();
    const imageData = image && !image.isEmpty() ? image.toDataURL() : '';

    // Text changed
    if (text && text !== this.lastText) {
      this.lastText = text;
      this.lastImage = imageData;
      this.onClipboardChange({ type: 'text', text, imageData });
      return;
    }

    // Image changed (no text change)
    if (imageData && imageData !== this.lastImage) {
      this.lastImage = imageData;
      this.lastText = text;
      this.onClipboardChange({ type: 'image', text, imageData });
    }
  }
}

module.exports = { ClipboardEngine };
