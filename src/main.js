const { app, Tray, Menu, Notification, shell } = require('electron');
const { ClipboardEngine } = require('./clipboard-engine');
const { ReferenceQueue } = require('./reference-queue');
const { TranscriptionDetector } = require('./transcription-detector');
const { ReferenceReplacer } = require('./reference-replacer');
const { FallbackPaster } = require('./fallback-paster');
const { KeyListener } = require('./key-listener');
const { Session } = require('./session');
const { recordHotkey } = require('./recorder-window');
const settingsStore = require('./settings');
const { buildLabel } = require('./hotkey-label');
const { makeIdleIcon, makeRecordingIcon } = require('./icons');

let tray = null;
let engine = null;
let queue = null;
let detector = null;
let replacer = null;
let fallback = null;
let keyListener = null;
let session = null;
let settings = settingsStore.DEFAULTS;
let idleIcon = null;
let recordingIcon = null;

app.dock?.hide();
app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });

app.whenReady().then(() => {
  settings = settingsStore.load();

  queue = new ReferenceQueue();
  detector = new TranscriptionDetector();
  replacer = new ReferenceReplacer();
  fallback = new FallbackPaster();

  engine = new ClipboardEngine({
    intervalMs: 100,
    onClipboardChange: (content) => session.handleClipboardChange(content),
  });
  fallback.engine = engine;

  keyListener = new KeyListener();
  fallback.keyListener = keyListener;

  session = new Session({
    queue,
    detector,
    replacer,
    fallback,
    onStateChange: updateTray,
  });

  keyListener.setHotkeys(settings);
  keyListener.on('hold:down', () => session.startIfWisprRunning());
  keyListener.on('hold:up', () => session.arm());
  keyListener.on('toggle:press', () => session.togglePress());

  createTray();
  engine.start();
  const started = keyListener.start();
  if (!started) {
    notify('RefLink', 'Needs Accessibility permission. Open menu → Grant access.');
  }
});

function createTray() {
  idleIcon = makeIdleIcon();
  recordingIcon = makeRecordingIcon();
  tray = new Tray(idleIcon);
  updateTray();
}

function updateTray() {
  if (!tray) return;
  const refs = queue ? queue.getAll() : [];
  const texts = refs.filter((r) => r.type === 'text').length;
  const imgs = refs.filter((r) => r.type === 'image').length;
  const active = session?.active;

  tray.setImage(active ? recordingIcon : idleIcon);

  if (!active) {
    tray.setTitle('');
  } else if (refs.length === 0) {
    tray.setTitle(' 0');
  } else {
    const parts = [];
    if (texts) parts.push(`${texts}T`);
    if (imgs) parts.push(`${imgs}I`);
    tray.setTitle(` ${parts.join(' ')}`);
  }

  const started = keyListener?.started;
  const status = !started
    ? 'Needs Accessibility permission'
    : active
      ? `Recording  |  ${texts} text  ${imgs} img`
      : 'Waiting for Wispr Flow';
  const holdLabel = buildLabel(settings.hold);
  const toggleLabel = buildLabel(settings.toggle);

  const items = [
    { label: status, enabled: false },
    { type: 'separator' },
  ];

  if (!started) {
    items.push(
      { label: 'Grant Accessibility access…', click: openAccessibilitySettings },
      { label: 'Retry after granting', click: retryKeyListener },
      { type: 'separator' }
    );
  }

  items.push(
    { label: `Hold:   ${holdLabel}`, click: () => changeHotkey('hold'), enabled: !!started },
    { label: `Toggle: ${toggleLabel}`, click: () => changeHotkey('toggle'), enabled: !!started },
    { type: 'separator' },
    { label: 'Clear queue', click: () => { queue.clear(); updateTray(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  );

  tray.setContextMenu(Menu.buildFromTemplate(items));
}

function openAccessibilitySettings() {
  shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility');
}

function retryKeyListener() {
  const ok = keyListener.start();
  if (ok) notify('RefLink', 'Listening for hotkeys.');
  else notify('RefLink', 'Still no access. Toggle RefLink in System Settings.');
  updateTray();
}

async function changeHotkey(which) {
  const result = await recordHotkey({ keyListener, which });
  if (!result) return;
  settings = settingsStore.setHotkey(settings, which, result);
  keyListener.setHotkeys(settings);
  updateTray();
  notify('RefLink', `${which} set to ${result.label}`);
}

function notify(title, body) {
  new Notification({ title, body, silent: true }).show();
}

app.on('will-quit', () => {
  keyListener?.stop();
  engine?.stop();
});

app.on('window-all-closed', (e) => e.preventDefault());
