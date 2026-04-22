const { UiohookKey } = require('uiohook-napi');

// Reverse map: keycode → label
const KEY_LABELS = (() => {
  const out = {};
  for (const [name, code] of Object.entries(UiohookKey)) {
    if (!(code in out)) out[code] = name;
  }
  // Nicer display overrides
  out[57] = 'Space';
  out[1] = 'Esc';
  out[14] = 'Backspace';
  out[15] = 'Tab';
  out[28] = 'Enter';
  return out;
})();

function buildLabel({ keycode, alt, ctrl, meta, shift }) {
  if (keycode == null) return '(unbound)';
  const parts = [];
  if (ctrl) parts.push('⌃');
  if (alt) parts.push('⌥');
  if (shift) parts.push('⇧');
  if (meta) parts.push('⌘');
  parts.push(KEY_LABELS[keycode] || `key ${keycode}`);
  return parts.join(' ');
}

module.exports = { buildLabel };
