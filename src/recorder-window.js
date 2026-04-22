const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { buildLabel } = require('./hotkey-label');

// Opens a small modal-ish window, switches the KeyListener into recording mode,
// and resolves with the captured hotkey (or null if cancelled/window closed).
function recordHotkey({ keyListener, which }) {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 320,
      height: 160,
      resizable: false,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      title: 'Record Hotkey',
      alwaysOnTop: true,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });
    win.setMenu(null);
    win.loadFile(path.join(__dirname, 'recorder.html'));

    const title = which === 'hold' ? 'Recording HOLD key…' : 'Recording TOGGLE key…';

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      keyListener.endRecording();
      keyListener.off('record', onRecord);
      ipcMain.off('recorder:cancel', onCancel);
      if (!win.isDestroyed()) win.close();
      resolve(result);
    };

    const onRecord = (e) => {
      const hotkey = {
        keycode: e.keycode,
        alt: !!e.altKey,
        ctrl: !!e.ctrlKey,
        meta: !!e.metaKey,
        shift: !!e.shiftKey,
      };
      hotkey.label = buildLabel(hotkey);
      if (!win.isDestroyed()) win.webContents.send('recorder:preview', hotkey.label);
      // brief pause so user sees the capture, then close
      setTimeout(() => finish(hotkey), 250);
    };

    const onCancel = () => finish(null);

    win.webContents.once('did-finish-load', () => {
      win.webContents.send('recorder:title', title);
      keyListener.beginRecording();
      keyListener.on('record', onRecord);
      ipcMain.on('recorder:cancel', onCancel);
    });

    win.on('closed', () => finish(null));
  });
}

module.exports = { recordHotkey };
