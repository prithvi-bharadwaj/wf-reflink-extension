const { BrowserWindow, ipcMain, screen, shell } = require('electron');
const path = require('path');
const { recordHotkey } = require('./recorder-window');

function openOnboarding({ keyListener, tray, getSettings, onHotkeySet, onAccessibilityChange }) {
  return new Promise((resolve) => {
    const primary = screen.getPrimaryDisplay();
    const { x, y, width, height } = primary.bounds;

    const win = new BrowserWindow({
      x, y, width, height,
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
      focusable: true,
      backgroundColor: '#00000000',
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });
    win.setMenu(null);
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.loadFile(path.join(__dirname, 'onboarding.html'));

    const handlers = {};
    const on = (channel, fn) => {
      handlers[channel] = fn;
      ipcMain.on(channel, fn);
    };

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      Object.entries(handlers).forEach(([ch, fn]) => ipcMain.off(ch, fn));
      if (!win.isDestroyed()) win.close();
      resolve();
    };

    on('onboarding:close', finish);

    on('onboarding:open-accessibility', () => {
      shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
    });

    on('onboarding:check-accessibility', () => {
      const granted = keyListener.started || keyListener.start();
      onAccessibilityChange?.(granted);
      if (!win.isDestroyed()) {
        win.webContents.send('onboarding:accessibility-state', { granted });
      }
    });

    on('onboarding:record-hotkey', async (_e, { which }) => {
      if (!keyListener.started) {
        if (!win.isDestroyed()) {
          win.webContents.send('onboarding:accessibility-state', { granted: false });
        }
        return;
      }
      if (!win.isDestroyed()) win.hide();
      const result = await recordHotkey({ keyListener, which });
      if (!win.isDestroyed()) win.show();
      if (result) {
        onHotkeySet?.(which, result);
        if (!win.isDestroyed()) {
          win.webContents.send('onboarding:hotkey-captured', { which, label: result.label });
        }
      }
    });

    win.webContents.once('did-finish-load', () => {
      const s = getSettings();
      let trayBounds = null;
      try {
        const b = tray?.getBounds?.();
        if (b && b.width) trayBounds = { x: b.x, y: b.y, width: b.width, height: b.height };
      } catch (_) { /* getBounds can fail if tray not laid out yet */ }
      win.webContents.send('onboarding:init', {
        holdLabel: s.hold.label,
        toggleLabel: s.toggle.label,
        trayBounds,
        screenWidth: width,
      });
    });

    win.on('closed', finish);
  });
}

module.exports = { openOnboarding };
