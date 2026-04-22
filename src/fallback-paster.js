// Pastes images at cursor position after Wispr Flow's text paste lands.
// Stops clipboard polling during paste to avoid re-capturing our own writes.

const { clipboard, nativeImage } = require('electron');
const { execFile } = require('child_process');

const PASTE_SCRIPT = `tell application "System Events" to keystroke "v" using command down`;

class FallbackPaster {
  constructor() {
    this.engine = null;
  }

  async pasteImages(images) {
    this.engine?.stop();

    for (const img of images) {
      const native = nativeImage.createFromDataURL(img.imageData);
      if (native.isEmpty()) continue;
      clipboard.writeImage(native);
      await runAppleScript(PASTE_SCRIPT);
      await sleep(250);
    }

    this.engine?.start();
  }
}

function runAppleScript(script) {
  return new Promise((resolve) => {
    execFile('osascript', ['-e', script], () => resolve());
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { FallbackPaster };
