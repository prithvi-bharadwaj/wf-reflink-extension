const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// Hotkey shape: { keycode: number|null, alt: bool, ctrl: bool, meta: bool, shift: bool, label: string }
// keycode=null means unbound.

const PASTE_MODES = Object.freeze(['segmented', 'batch']);
const PASTE_DELAY_OPTIONS = Object.freeze([50, 100, 150, 200, 300, 500]);

// Matches the old hardcoded regex `/(?:inserted|embedded|insert|embed)\s+(?:links?|images?)/i`.
const DEFAULT_TRIGGERS = Object.freeze([
  'insert link', 'insert links', 'insert image', 'insert images',
  'embed link', 'embed links', 'embed image', 'embed images',
  'inserted link', 'inserted links', 'inserted image', 'inserted images',
  'embedded link', 'embedded links', 'embedded image', 'embedded images',
]);

const DEFAULTS = Object.freeze({
  hold: Object.freeze({ keycode: null, alt: false, ctrl: false, meta: false, shift: false, label: 'Fn (tap to record)' }),
  toggle: Object.freeze({ keycode: 57, alt: true, ctrl: false, meta: false, shift: false, label: '⌥ Space' }),
  pasteMode: 'segmented',
  pasteDelayMs: 250,
  triggers: DEFAULT_TRIGGERS,
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
    const triggers = Array.isArray(parsed.triggers)
      ? Object.freeze(normalizeTriggers(parsed.triggers))
      : DEFAULTS.triggers;
    return Object.freeze({
      hold: Object.freeze({ ...DEFAULTS.hold, ...(parsed.hold || {}) }),
      toggle: Object.freeze({ ...DEFAULTS.toggle, ...(parsed.toggle || {}) }),
      pasteMode,
      pasteDelayMs,
      triggers,
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

// Trim, lowercase, drop empties and dupes. Triggers match case-insensitive
// downstream; storing them canonical keeps the UI deduping obvious.
function normalizeTriggers(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    if (typeof raw !== 'string') continue;
    const phrase = raw.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!phrase) continue;
    if (seen.has(phrase)) continue;
    seen.add(phrase);
    out.push(phrase);
  }
  return out;
}

module.exports = {
  load, save, setHotkey, setField, hotkeyLabel,
  normalizeTriggers,
  DEFAULTS, PASTE_MODES, PASTE_DELAY_OPTIONS, DEFAULT_TRIGGERS,
};
