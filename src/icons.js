const { nativeImage } = require('electron');

const IDLE_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABfSURBVDiNY/z//z8DEwMDAwMDAwOTkpISAyMjIwMDAwMDCwMDA8P///8ZGBgYGJgYGBgY/v//z8DIyMjAwMDAwMLAwMDw//9/BkZGRgYGBgYGFgYGBob///8zMDIyMgAAN5kPGXKTrWgAAAAASUVORK5CYII=';

// Draws a filled red disc with antialiased edge, as raw BGRA bitmap.
// Rendered at 2x for retina-sharp menu bars.
function makeRecordingIcon() {
  const SIZE = 32; // physical pixels; logical size is 16 at scaleFactor 2
  const buf = Buffer.alloc(SIZE * SIZE * 4);
  const cx = (SIZE - 1) / 2;
  const cy = (SIZE - 1) / 2;
  const r = SIZE * 0.36;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x - cx, y - cy);
      let alpha = 0;
      if (d <= r - 0.5) alpha = 255;
      else if (d < r + 0.5) alpha = Math.round(255 * (r + 0.5 - d));

      const i = (y * SIZE + x) * 4;
      buf[i + 0] = 38;  // B
      buf[i + 1] = 38;  // G
      buf[i + 2] = 220; // R  (≈ #DC2626)
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
