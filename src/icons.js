const { nativeImage } = require('electron');

const IDLE_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABfSURBVDiNY/z//z8DEwMDAwMDAwOTkpISAyMjIwMDAwMDCwMDA8P///8ZGBgYGJgYGBgY/v//z8DIyMjAwMDAwMLAwMDw//9/BkZGRgYGBgYGFgYGBob///8zMDIyMgAAN5kPGXKTrWgAAAAASUVORK5CYII=';

// Soft coral red, subtle vertical gradient for depth, smaller radius for polish.
function makeRecordingIcon() {
  const SIZE = 32; // physical pixels; logical size is 16 at scaleFactor 2
  const buf = Buffer.alloc(SIZE * SIZE * 4);
  const cx = (SIZE - 1) / 2;
  const cy = (SIZE - 1) / 2;
  const r = SIZE * 0.28;

  const topR = 242, topG = 112, topB = 112;
  const botR = 210, botG = 72,  botB = 72;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x - cx, y - cy);
      let alpha = 0;
      if (d <= r - 0.75) alpha = 255;
      else if (d < r + 0.75) alpha = Math.round(255 * ((r + 0.75 - d) / 1.5));
      if (alpha === 0) continue;

      const t = Math.min(1, Math.max(0, (y - (cy - r)) / (2 * r)));
      const rCol = Math.round(topR + (botR - topR) * t);
      const gCol = Math.round(topG + (botG - topG) * t);
      const bCol = Math.round(topB + (botB - topB) * t);

      const i = (y * SIZE + x) * 4;
      buf[i + 0] = bCol;
      buf[i + 1] = gCol;
      buf[i + 2] = rCol;
      buf[i + 3] = alpha;
    }
  }

  return nativeImage.createFromBitmap(buf, { width: SIZE, height: SIZE, scaleFactor: 2 });
}

function makeIdleIcon() {
  const icon = nativeImage.createFromDataURL(IDLE_DATA_URL);
  icon.setTemplateImage(true);
  return icon;
}

module.exports = { makeIdleIcon, makeRecordingIcon };
