// Owns every paste we do after detecting a Wispr transcription.
//
// Two modes:
//
//   segmented (default) — we fully take over from Wispr:
//     1. Overwrite Wispr's clipboard with empty text so its Cmd+V pastes nothing.
//     2. For each segment (text or ref), writeClipboard → synthesize Cmd+V → sleep.
//     Result: text and images interleaved at their trigger positions.
//
//   batch — Wispr pastes one flattened text string, then we append images:
//     1. Flatten segments into one text (text refs inlined, image triggers removed).
//     2. Put that text on clipboard; Wispr's Cmd+V pastes it.
//     3. After a short wait, paste each image via Cmd+V.
//     Result: text block first, then a tail of images.
//
// Cmd+V is synthesized via uiohook (reuses the Accessibility permission we
// already need for global keys — AppleScript's "System Events" automation
// permission is a separate prompt most users never grant).

const { clipboard, nativeImage } = require('electron');
const { uIOhook, UiohookKey } = require('uiohook-napi');

const PRE_KEYTAP_SLEEP_MS = 40;   // let clipboard write land before Cmd+V
const WISPR_PASTE_WAIT_MS = 300;  // wait for Wispr's own Cmd+V in batch mode

class Paster {
  constructor({ replacer }) {
    this.replacer = replacer;
    this.engine = null;
    this.keyListener = null;
  }

  async paste({ segments, mode, delayMs }) {
    if (mode === 'batch') return this._batch(segments, delayMs);
    return this._segmented(segments, delayMs);
  }

  async _segmented(segments, delayMs) {
    // Wispr has just written its transcription to the clipboard and is about
    // to fire Cmd+V. Overwrite with empty so its paste is a no-op; we'll
    // paste each segment ourselves.
    clipboard.writeText('');

    this.engine?.stop();
    if (this.keyListener) this.keyListener.suspended = true;
    try {
      // Give Wispr's in-flight Cmd+V a moment to fire against the empty clipboard.
      await sleep(WISPR_PASTE_WAIT_MS);

      for (const seg of segments) {
        const wrote = this._writeSegment(seg);
        if (!wrote) continue;
        await sleep(PRE_KEYTAP_SLEEP_MS);
        try { uIOhook.keyTap(UiohookKey.V, [UiohookKey.Meta]); } catch { /* ignore */ }
        await sleep(delayMs);
      }
    } finally {
      if (this.keyListener) this.keyListener.suspended = false;
      this.engine?.start();
    }
  }

  async _batch(segments, delayMs) {
    const { text, images } = this.replacer.flattenForBatch(segments);

    clipboard.writeText(text);

    if (images.length === 0) return;

    // Wispr pastes the text, then we append images.
    await sleep(WISPR_PASTE_WAIT_MS);
    this.engine?.stop();
    if (this.keyListener) this.keyListener.suspended = true;
    try {
      for (const img of images) {
        const native = nativeImage.createFromDataURL(img.imageData);
        if (native.isEmpty()) continue;
        clipboard.writeImage(native);
        await sleep(PRE_KEYTAP_SLEEP_MS);
        try { uIOhook.keyTap(UiohookKey.V, [UiohookKey.Meta]); } catch { /* ignore */ }
        await sleep(delayMs);
      }
    } finally {
      if (this.keyListener) this.keyListener.suspended = false;
      this.engine?.start();
    }
  }

  _writeSegment(seg) {
    if (seg.type === 'text') {
      if (!seg.content) return false;
      clipboard.writeText(seg.content);
      return true;
    }
    if (seg.ref.type === 'image') {
      const native = nativeImage.createFromDataURL(seg.ref.imageData);
      if (native.isEmpty()) return false;
      clipboard.writeImage(native);
      return true;
    }
    const txt = (seg.ref.text || '').trim();
    if (!txt) return false;
    clipboard.writeText(txt);
    return true;
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { Paster };
