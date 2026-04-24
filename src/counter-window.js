const { BrowserWindow, screen } = require('electron');
const path = require('path');

// The visible pill is ~95px wide and ~30px tall.
// The window box is intentionally wider/taller than the pill so the slide-in
// transform doesn't clip on the left edge.
const PILL_WIDTH = 110;       // visible pill footprint (matches design width)
const PILL_HEIGHT = 40;       // 2% taller
const SLIDE_TRAVEL = 60;      // how far the pill slides in from the left

const WIN_WIDTH = PILL_WIDTH + SLIDE_TRAVEL * 2; // 230
const WIN_HEIGHT = PILL_HEIGHT + 16;             // 56: room for shadow

const BOTTOM_MARGIN = -11;   // 1px up from previous (-12)
const X_OFFSET = 100;        // pill center sits at screenCenter + 100

let win = null;
let ready = false;
let pending = null;
let hideTimer = null;
let lastVisible = false;

function ensureWindow() {
  if (win && !win.isDestroyed()) return win;

  const primary = screen.getPrimaryDisplay();
  const { x, y, width, height } = primary.workArea;
  const winX = Math.round(x + (width - WIN_WIDTH) / 2 + X_OFFSET);
  const winY = Math.round(y + height - WIN_HEIGHT - BOTTOM_MARGIN);

  win = new BrowserWindow({
    x: winX,
    y: winY,
    width: WIN_WIDTH,
    height: WIN_HEIGHT,
    frame: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  win.setMenu(null);
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'counter.html'));

  win.webContents.once('did-finish-load', () => {
    ready = true;
    if (pending) {
      win.webContents.send('counter:update', pending);
      pending = null;
    }
  });

  win.on('closed', () => {
    win = null;
    ready = false;
  });

  return win;
}

function update({ texts = 0, imgs = 0, visible = false }) {
  const w = ensureWindow();
  const payload = { texts, imgs, visible };

  // A pending hide from a previous invisible-update would race and snap the
  // window away right after we just showed it. Cancel it whenever we go visible.
  if (visible && hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }

  if (visible && !w.isVisible()) w.showInactive();

  if (ready) {
    w.webContents.send('counter:update', payload);
  } else {
    pending = payload;
  }

  // Only schedule a hide on the falling edge of visibility — repeated
  // visible:false updates shouldn't reset the timer.
  if (!visible && lastVisible) {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      hideTimer = null;
      if (w && !w.isDestroyed()) w.hide();
    }, 520);
  }

  lastVisible = visible;
}

function destroy() {
  if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
  if (win && !win.isDestroyed()) win.close();
  win = null;
  ready = false;
  pending = null;
  lastVisible = false;
}

module.exports = { update, destroy };
