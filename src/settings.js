const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// Hotkey shape: { keycode: number|null, alt: bool, ctrl: bool, meta: bool, shift: bool, label: string }
// keycode=null means unbound.

const PASTE_MODES = Object.freeze(['segmented', 'batch']);
const PASTE_DELAY_OPTIONS = Object.freeze([50, 100, 150, 200, 300, 500]);

const DEFAULTS = Object.freeze({
  hold: Object.freeze({ keycode: null, alt: false, ctrl: false, meta: false, shift: false, label: 'Fn (tap to record)' }),
  toggle: Object.freeze({ keycode: 57, alt: true, ctrl: false, meta: false, shift: false, label: '⌥ Space' }),
  pasteMode: 'segmented',
  pasteDelayMs: 150,
});

function filePath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function load() {
  try {
    const raw = fs.readFileSync(filePath(), 'utf8');
    const parsed = JSON.parse(raw);
    const pasteMode = PASTE_MODES.includes(parsed.pasteMode) ? parsed.pasteMode : DEFAULTS.pasteMode;
    const pasteDelayMs = PASTE_DELAY_OPTIONS.includes(parsed.pasteDelayMs) ? parsed.pasteDelayMs : DEFAULTS.pasteDelayMs;
    return Object.freeze({
      hold: Object.freeze({ ...DEFAULTS.hold, ...(parsed.hold || {}) }),
      toggle: Object.freeze({ ...DEFAULTS.toggle, ...(parsed.toggle || {}) }),
      pasteMode,
      pasteDelayMs,
    });
  } catch {
    return DEFAULTS;
  }
}

function setField(settings, key, value) {
  const next = Object.freeze({ ...settings, [key]: value });
  save(next);
  return next;
}

function save(settings) {
  fs.writeFileSync(filePath(), JSON.stringify(settings, null, 2), 'utf8');
}

function setHotkey(settings, which, hotkey) {
  const next = Object.freeze({
    ...settings,
    [which]: Object.freeze({ ...hotkey }),
  });
  save(next);
  return next;
}

function hotkeyLabel(h) {
  if (h.keycode == null) return '(unbound)';
  return h.label || '(recorded)';
}

module.exports = { load, save, setHotkey, setField, hotkeyLabel, DEFAULTS, PASTE_MODES, PASTE_DELAY_OPTIONS };
