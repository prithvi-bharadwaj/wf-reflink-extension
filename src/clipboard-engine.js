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

  // Reset the baseline to match the current system clipboard. Call this after
  // anything that may have changed the clipboard behind our back (e.g. a
  // session start that cleared it) so the next real user copy fires a change.
  resync() {
    this.lastText = clipboard.readText();
    this.lastImage = clipboard.readImage()?.toDataURL() || '';
  }

  _poll() {
    const text = clipboard.readText();
    const image = clipboard.readImage();
    const imageData = image && !image.isEmpty() ? image.toDataURL() : '';

    const textChanged = text && text !== this.lastText;
    const imageChanged = imageData && imageData !== this.lastImage;

    if (!textChanged && !imageChanged) return;

    // Image changes take priority. Browsers (and many apps) write the image
    // URL as text alongside the image bytes when you "Copy image"; without
    // this we'd store the copy as a text ref and lose the picture.
    if (imageChanged) {
      this.lastText = text;
      this.lastImage = imageData;
      this.onClipboardChange({ type: 'image', text, imageData });
      return;
    }

    this.lastText = text;
    this.lastImage = imageData;
    this.onClipboardChange({ type: 'text', text, imageData });
  }
}

module.exports = { ClipboardEngine };
