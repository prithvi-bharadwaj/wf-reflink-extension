// Pastes images at cursor position after Wispr Flow's text paste lands.
// Stops clipboard polling during paste to avoid re-capturing our own writes.
// Uses uiohook for Cmd+V (reuses the Accessibility permission already
// granted for global key listening) instead of AppleScript, which needs a
// separate "System Events" automation permission the user rarely has.

const { clipboard, nativeImage } = require('electron');
const { uIOhook, UiohookKey } = require('uiohook-napi');

class FallbackPaster {
  constructor() {
    this.engine = null;
    this.keyListener = null;
  }

  async pasteImages(images) {
    this.engine?.stop();
    if (this.keyListener) this.keyListener.suspended = true;

    try {
      for (const img of images) {
        const native = nativeImage.createFromDataURL(img.imageData);
        if (native.isEmpty()) continue;
        clipboard.writeImage(native);
        await sleep(50); // give the clipboard write a moment to land
        try { uIOhook.keyTap(UiohookKey.V, [UiohookKey.Meta]); } catch { /* ignore */ }
        await sleep(250);
      }
    } finally {
      if (this.keyListener) this.keyListener.suspended = false;
      this.engine?.start();
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { FallbackPaster };
