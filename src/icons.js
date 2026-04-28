const { nativeImage } = require('electron');

// Variant F: typographic "[ • ]" — bracket-with-dot.
// All states are template images so macOS auto-tints for light/dark menu bars.
// The dot conveys session state:
//   IDLE                 → no dot          (just brackets)
//   ACTIVE + empty queue → pulsing dot     (animated, "waiting")
//   ACTIVE + items       → solid dot       (the queue is filling)

const SIZE = 32; // physical pixels; logical 16 at scaleFactor 2

function aaCoverage(d) {
  if (d <= -0.5) return 255;
  if (d >= 0.5) return 0;
  return Math.round(255 * (0.5 - d));
}

function sdfHLine(px, py, x0, x1, y) {
  const cx = Math.min(Math.max(px, x0), x1);
  return Math.hypot(px - cx, py - y);
}

function sdfVLine(px, py, x, y0, y1) {
  const cy = Math.min(Math.max(py, y0), y1);
  return Math.hypot(px - x, py - cy);
}

function strokeAlpha(d, halfW) {
  return aaCoverage(d - halfW);
}

function fillCircleAlpha(px, py, cx, cy, r) {
  return aaCoverage(Math.hypot(px - cx, py - cy) - r);
}

// Draws "[ • ]" into a fresh BGRA buffer. dotAlphaScale ∈ [0..1] modulates
// the dot's opacity (used for the pulsing waiting animation; 0 = no dot).
function renderBracketDot({ dotAlphaScale = 1 } = {}) {
  const buf = Buffer.alloc(SIZE * SIZE * 4);

  // Geometry on the 32×32 physical grid:
  //   Bracket verticals at x=8 (left) and x=24 (right), y=6..26
  //   Bracket caps span 5 px horizontally
  //   Center dot at (16, 16), radius 2.6
  const stroke = 2.2;
  const half = stroke / 2;
  const top = 6;
  const bot = 26;
  const lvx = 8, ltx0 = 8, ltx1 = 13;
  const rvx = 24, rtx0 = 19, rtx1 = 24;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let a = 0;

      // Left bracket
      a = Math.max(a, strokeAlpha(sdfVLine(px, py, lvx, top, bot), half));
      a = Math.max(a, strokeAlpha(sdfHLine(px, py, ltx0, ltx1, top), half));
      a = Math.max(a, strokeAlpha(sdfHLine(px, py, ltx0, ltx1, bot), half));

      // Right bracket
      a = Math.max(a, strokeAlpha(sdfVLine(px, py, rvx, top, bot), half));
      a = Math.max(a, strokeAlpha(sdfHLine(px, py, rtx0, rtx1, top), half));
      a = Math.max(a, strokeAlpha(sdfHLine(px, py, rtx0, rtx1, bot), half));

      // Dot
      if (dotAlphaScale > 0) {
        const dotA = Math.round(fillCircleAlpha(px, py, 16, 16, 2.6) * dotAlphaScale);
        a = Math.max(a, dotA);
      }

      const i = (y * SIZE + x) * 4;
      buf[i + 0] = 0;
      buf[i + 1] = 0;
      buf[i + 2] = 0;
      buf[i + 3] = a;
    }
  }

  return buf;
}

function bufToImage(buf) {
  const img = nativeImage.createFromBitmap(buf, { width: SIZE, height: SIZE, scaleFactor: 2 });
  img.setTemplateImage(true);
  return img;
}

function makeIdleIcon() {
  return bufToImage(renderBracketDot({ dotAlphaScale: 0 }));
}

function makeActiveIcon() {
  return bufToImage(renderBracketDot({ dotAlphaScale: 1 }));
}

// Sine-driven pulse, 8 frames at ~180ms each → ~1.45s cycle. Alpha rides
// 0.35..1.0 so the dot never disappears completely (avoids the "gap" feel
// in the menu bar).
function makeWaitingFrames() {
  const N = 8;
  const frames = [];
  for (let i = 0; i < N; i++) {
    const t = (i / N) * 2 * Math.PI;
    const scale = 0.675 + 0.325 * Math.sin(t); // 0.35..1.0
    frames.push(bufToImage(renderBracketDot({ dotAlphaScale: scale })));
  }
  return frames;
}

module.exports = { makeIdleIcon, makeActiveIcon, makeWaitingFrames };
