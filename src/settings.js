const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// Hotkey shape: { keycode: number|null, alt: bool, ctrl: bool, meta: bool, shift: bool, label: string }
// keycode=null means unbound.

const DEFAULTS = Object.freeze({
  hold: Object.freeze({ keycode: null, alt: false, ctrl: false, meta: false, shift: false, label: 'Fn (tap to record)' }),
  toggle: Object.freeze({ keycode: 57, alt: true, ctrl: false, meta: false, shift: false, label: '⌥ Space' }),
});

function filePath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function load() {
  try {
    const raw = fs.readFileSync(filePath(), 'utf8');
    const parsed = JSON.parse(raw);
    return Object.freeze({
      hold: Object.freeze({ ...DEFAULTS.hold, ...(parsed.hold || {}) }),
      toggle: Object.freeze({ ...DEFAULTS.toggle, ...(parsed.toggle || {}) }),
    });
  } catch {
    return DEFAULTS;
  }
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

module.exports = { load, save, setHotkey, hotkeyLabel, DEFAULTS };
