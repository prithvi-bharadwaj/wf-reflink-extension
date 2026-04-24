const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Opens a persistent settings-style window for managing trigger phrases.
// Changes are reported live via `onUpdate(triggers)` — main persists them
// and re-syncs the detector/replacer without closing the window.
//
// Only one window at a time. Calling while already open focuses the existing
// window instead of opening a duplicate.

let current = null;

function openTriggerManager({ initialTriggers, onUpdate }) {
  if (current && !current.isDestroyed()) {
    current.focus();
    return current;
  }

  const win = new BrowserWindow({
    width: 440,
    height: 440,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: 'Trigger Phrases',
    alwaysOnTop: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  win.setMenu(null);
  win.loadFile(path.join(__dirname, 'triggers.html'));

  const onTriggersUpdate = (_e, triggers) => {
    if (!Array.isArray(triggers)) return;
    onUpdate(triggers);
  };

  ipcMain.on('triggers:update', onTriggersUpdate);

  win.webContents.once('did-finish-load', () => {
    win.webContents.send('triggers:init', initialTriggers);
  });

  win.on('closed', () => {
    ipcMain.off('triggers:update', onTriggersUpdate);
    if (current === win) current = null;
  });

  current = win;
  return win;
}

module.exports = { openTriggerManager };
