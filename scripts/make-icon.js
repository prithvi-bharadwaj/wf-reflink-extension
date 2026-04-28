#!/usr/bin/env node
// Generates icon.icns for the .app bundle from the variant-F bracket-dot design.
// Pure Node: writes a 1024×1024 PNG with the SDF renderer, then shells out to
// macOS's `sips` and `iconutil` to produce the iconset and final .icns.

const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

// --- minimal PNG encoder (RGBA8, no deps) -----------------------------------

function crc32(buf) {
  let table = crc32._table;
  if (!table) {
    table = crc32._table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c >>> 0;
    }
  }
  let c = 0xffffffff >>> 0;
  for (let i = 0; i < buf.length; i++) c = (table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)) >>> 0;
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = width * 4;
  const filtered = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    filtered[y * (stride + 1)] = 0;
    rgba.copy(filtered, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(filtered, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// --- SDF rasterizer ---------------------------------------------------------

function aaCoverage(d) {
  if (d <= -0.5) return 1;
  if (d >= 0.5) return 0;
  return 0.5 - d;
}

function sdfRoundRect(px, py, x0, y0, x1, y1, r) {
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const hw = (x1 - x0) / 2 - r, hh = (y1 - y0) / 2 - r;
  const dx = Math.abs(px - cx) - hw, dy = Math.abs(py - cy) - hh;
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r;
}

function sdfHLine(px, py, x0, x1, y) {
  const cx = Math.min(Math.max(px, x0), x1);
  return Math.hypot(px - cx, py - y);
}

function sdfVLine(px, py, x, y0, y1) {
  const cy = Math.min(Math.max(py, y0), y1);
  return Math.hypot(px - x, py - cy);
}

function sdfCircle(px, py, cx, cy, r) {
  return Math.hypot(px - cx, py - cy) - r;
}

// --- icon ------------------------------------------------------------------

function renderAppIcon(SIZE) {
  const buf = Buffer.alloc(SIZE * SIZE * 4);

  // Apple-style squircle background (corner radius ≈ 22.4% of edge).
  const BG_R = SIZE * 0.224;
  const BG = { r: 26, g: 26, b: 28 };   // charcoal #1a1a1c
  const FG = { r: 255, g: 255, b: 255 };

  // Glyph in normalized [0..1024] coords; scaled up uniformly.
  const k = SIZE / 1024;
  const stroke = 64 * k;
  const half = stroke / 2;
  const top = 280 * k, bot = 744 * k;
  const lvx = 288 * k, ltx0 = 288 * k, ltx1 = 448 * k;
  const rvx = 736 * k, rtx0 = 576 * k, rtx1 = 736 * k;
  const dotCx = 512 * k, dotCy = 512 * k, dotR = 80 * k;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const px = x + 0.5, py = y + 0.5;

      const bgA = aaCoverage(sdfRoundRect(px, py, 0, 0, SIZE, SIZE, BG_R));
      if (bgA === 0) {
        const i = (y * SIZE + x) * 4;
        buf[i + 0] = 0; buf[i + 1] = 0; buf[i + 2] = 0; buf[i + 3] = 0;
        continue;
      }

      let gA = 0;
      gA = Math.max(gA, aaCoverage(sdfVLine(px, py, lvx, top, bot) - half));
      gA = Math.max(gA, aaCoverage(sdfHLine(px, py, ltx0, ltx1, top) - half));
      gA = Math.max(gA, aaCoverage(sdfHLine(px, py, ltx0, ltx1, bot) - half));
      gA = Math.max(gA, aaCoverage(sdfVLine(px, py, rvx, top, bot) - half));
      gA = Math.max(gA, aaCoverage(sdfHLine(px, py, rtx0, rtx1, top) - half));
      gA = Math.max(gA, aaCoverage(sdfHLine(px, py, rtx0, rtx1, bot) - half));
      gA = Math.max(gA, aaCoverage(sdfCircle(px, py, dotCx, dotCy, dotR)));

      const w = gA, inv = 1 - w;
      const i = (y * SIZE + x) * 4;
      buf[i + 0] = Math.round(FG.r * w + BG.r * inv);
      buf[i + 1] = Math.round(FG.g * w + BG.g * inv);
      buf[i + 2] = Math.round(FG.b * w + BG.b * inv);
      buf[i + 3] = Math.round(bgA * 255);
    }
  }
  return buf;
}

// --- pipeline --------------------------------------------------------------

const root = path.resolve(__dirname, '..');
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'reflink-icon-'));
const iconset = path.join(work, 'RefLink.iconset');
fs.mkdirSync(iconset, { recursive: true });

const SIZES = [
  [16,   'icon_16x16.png'],
  [32,   'icon_16x16@2x.png'],
  [32,   'icon_32x32.png'],
  [64,   'icon_32x32@2x.png'],
  [128,  'icon_128x128.png'],
  [256,  'icon_128x128@2x.png'],
  [256,  'icon_256x256.png'],
  [512,  'icon_256x256@2x.png'],
  [512,  'icon_512x512.png'],
  [1024, 'icon_512x512@2x.png'],
];

// Render each size directly (sharper than downsampling from one source).
console.log('Rendering iconset…');
for (const [size, name] of SIZES) {
  const rgba = renderAppIcon(size);
  const png = encodePng(size, size, rgba);
  fs.writeFileSync(path.join(iconset, name), png);
  console.log(`  ${name}  ${size}×${size}`);
}

const out = path.join(root, 'icon.icns');
console.log('Building icon.icns…');
execFileSync('iconutil', ['-c', 'icns', iconset, '-o', out], { stdio: 'inherit' });
console.log('Wrote', out);

fs.rmSync(work, { recursive: true, force: true });
