const { app, Tray, Menu, globalShortcut, clipboard, nativeImage, Notification } = require('electron');
const { ClipboardEngine } = require('./clipboard-engine');
const { ReferenceQueue } = require('./reference-queue');
const { TranscriptionDetector } = require('./transcription-detector');
const { ReferenceReplacer } = require('./reference-replacer');
const { FallbackPaster } = require('./fallback-paster');

let tray = null;
let engine = null;
let queue = null;
let detector = null;
let replacer = null;
let fallback = null;
let capturing = true;
let ignoreNextChange = false;

app.dock?.hide();
app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });

app.whenReady().then(() => {
  queue = new ReferenceQueue();
  detector = new TranscriptionDetector();
  replacer = new ReferenceReplacer();
  fallback = new FallbackPaster();

  engine = new ClipboardEngine({
    intervalMs: 100,
    onClipboardChange: handleClipboardChange,
  });

  fallback.engine = engine;
  createTray();
  globalShortcut.register('CommandOrControl+Shift+R', toggleCapture);
  engine.start();
});

function handleClipboardChange(content) {
  if (!capturing) return;
  if (ignoreNextChange) { ignoreNextChange = false; return; }

  const detected = detector.check(content, queue);
  if (detected) {
    const processed = replacer.process(detected.text, queue.getAll());
    if (processed.changed) {
      ignoreNextChange = true;
      clipboard.writeText(processed.text);
      notify('RefLink', `Injected ${processed.count} ref(s)`);

      if (processed.images.length > 0) {
        setTimeout(() => fallback.pasteImages(processed.images), 300);
      }
    }
    queue.clear();
    updateTray();
    return;
  }

  queue.push(content);
  updateTray();
}

function toggleCapture() {
  capturing = !capturing;
  if (capturing) queue.clear();
  updateTray();
  notify('RefLink', capturing ? 'ON' : 'OFF');
}

function createTray() {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABfSURBVDiNY/z//z8DEwMDAwMDAwOTkpISAyMjIwMDAwMDCwMDA8P///8ZGBgYGJgYGBgY/v//z8DIyMjAwMDAwMLAwMDw//9/BkZGRgYGBgYGFgYGBob///8zMDIyMgAAN5kPGXKTrWgAAAAASUVORK5CYII='
  );
  icon.setTemplateImage(true);
  tray = new Tray(icon);
  updateTray();
}

function updateTray() {
  if (!tray) return;
  const refs = queue ? queue.getAll() : [];
  const texts = refs.filter((r) => r.type === 'text').length;
  const imgs = refs.filter((r) => r.type === 'image').length;

  if (!capturing) {
    tray.setTitle(' OFF');
  } else if (refs.length === 0) {
    tray.setTitle(' 0');
  } else {
    const parts = [];
    if (texts) parts.push(`${texts}T`);
    if (imgs) parts.push(`${imgs}I`);
    tray.setTitle(` ${parts.join(' ')}`);
  }

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: capturing ? `Ready  |  ${texts} text  ${imgs} img` : 'Paused', enabled: false },
    { type: 'separator' },
    { label: capturing ? 'Pause' : 'Resume', click: toggleCapture, accelerator: 'CmdOrCtrl+Shift+R' },
    { label: 'Clear', click: () => { queue.clear(); updateTray(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]));
}

function notify(title, body) {
  new Notification({ title, body, silent: true }).show();
}

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  engine?.stop();
});

app.on('window-all-closed', (e) => e.preventDefault());
