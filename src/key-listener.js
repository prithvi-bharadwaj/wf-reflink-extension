const { EventEmitter } = require('events');
const { uIOhook } = require('uiohook-napi');

// Emits:
//   'hold:down'   when the configured hold key goes down
//   'hold:up'     when the configured hold key goes up
//   'toggle:press' when the configured toggle key goes down
//   'record'      (mode only) — raw event for the recorder UI
//
// Modifier keys (Shift/Ctrl/Alt/Meta) are not considered "main" keys on their
// own — we only emit hold/toggle when the event's keycode is a non-modifier
// AND the required modifiers match. Matching a plain modifier-only hotkey
// (e.g. Fn with no other key) works by using that modifier's own keycode
// if libuiohook emits it.

const MODIFIER_KEYCODES = new Set([
  29, 3613, // Ctrl, CtrlRight
  56, 3640, // Alt, AltRight
  42, 54,   // Shift, ShiftRight
  3675, 3676, // Meta, MetaRight
]);

function matches(hotkey, e) {
  if (hotkey.keycode == null) return false;
  if (hotkey.keycode !== e.keycode) return false;
  if (!!hotkey.alt !== !!e.altKey) return false;
  if (!!hotkey.ctrl !== !!e.ctrlKey) return false;
  if (!!hotkey.meta !== !!e.metaKey) return false;
  if (!!hotkey.shift !== !!e.shiftKey) return false;
  return true;
}

class KeyListener extends EventEmitter {
  constructor() {
    super();
    this.hotkeys = { hold: null, toggle: null };
    this.recording = false;
    this._held = false;

    uIOhook.on('keydown', (e) => this._onDown(e));
    uIOhook.on('keyup', (e) => this._onUp(e));
  }

  // Returns true on success. On macOS this fails until the user grants
  // Accessibility permission — we surface that to the caller so the UI can
  // show a nudge rather than crash.
  start() {
    try { uIOhook.start(); this.started = true; return true; }
    catch (err) { this.started = false; this.startError = err; return false; }
  }

  stop() {
    if (!this.started) return;
    try { uIOhook.stop(); } catch { /* ignore */ }
    this.started = false;
  }

  setHotkeys({ hold, toggle }) {
    this.hotkeys = { hold, toggle };
    // Reset any in-flight session state when bindings change.
    this._held = false;
  }

  beginRecording() { this.recording = true; }
  endRecording() { this.recording = false; }

  _onDown(e) {
    if (this.recording) {
      // Ignore pure modifier taps in recording — wait for a real key.
      if (MODIFIER_KEYCODES.has(e.keycode)) return;
      this.emit('record', e);
      return;
    }

    if (matches(this.hotkeys.hold, e)) {
      if (!this._held) {
        this._held = true;
        this.emit('hold:down');
      }
      return;
    }

    if (matches(this.hotkeys.toggle, e)) {
      this.emit('toggle:press');
    }
  }

  _onUp(e) {
    if (this.recording) return;
    if (matches(this.hotkeys.hold, e) && this._held) {
      this._held = false;
      this.emit('hold:up');
    }
  }
}

module.exports = { KeyListener, MODIFIER_KEYCODES };
