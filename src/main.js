const { app, Tray, Menu, Notification, shell } = require('electron');
const { ClipboardEngine } = require('./clipboard-engine');
const { ReferenceQueue } = require('./reference-queue');
const { TranscriptionDetector } = require('./transcription-detector');
const { ReferenceReplacer } = require('./reference-replacer');
const { Paster } = require('./paster');
const { KeyListener } = require('./key-listener');
const { Session } = require('./session');
const { recordHotkey } = require('./recorder-window');
const { openOnboarding } = require('./onboarding-window');
const counterWindow = require('./counter-window');
const wispr = require('./wispr-process');
const settingsStore = require('./settings');
const { buildLabel } = require('./hotkey-label');
const { makeIdleIcon, makeRecordingIcon } = require('./icons');

let tray = null;
let engine = null;
let queue = null;
let detector = null;
let replacer = null;
let paster = null;
let keyListener = null;
let session = null;
let settings = settingsStore.DEFAULTS;
let idleIcon = null;
let recordingIcon = null;
let wisprRunning = false;
let wisprPollTimer = null;

app.dock?.hide();
app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });

app.whenReady().then(() => {
  settings = settingsStore.load();

  queue = new ReferenceQueue();
  detector = new TranscriptionDetector();
  replacer = new ReferenceReplacer();
  paster = new Paster({ replacer });

  engine = new ClipboardEngine({
    intervalMs: 100,
    onClipboardChange: (content) => session.handleClipboardChange(content),
  });
  paster.engine = engine;

  keyListener = new KeyListener();
  paster.keyListener = keyListener;

  session = new Session({
    queue,
    detector,
    replacer,
    paster,
    getSettings: () => settings,
    onStateChange: updateTray,
  });

  keyListener.setHotkeys(settings);
  keyListener.on('hold:down', () => session.startIfWisprRunning());
  keyListener.on('hold:up', () => session.arm());
  keyListener.on('toggle:press', () => session.togglePress());

  createTray();
  engine.start();
  keyListener.start();

  pollWispr();
  wisprPollTimer = setInterval(pollWispr, 1500);

  if (!settings.onboardingShown) {
    runOnboarding(true);
  } else if (!keyListener.started) {
    notify('RefLink', 'Needs Accessibility permission. Open menu → Grant access.');
  }
});

function runOnboarding(markShown) {
  openOnboarding({
    keyListener,
    tray,
    getSettings: () => settings,
    onHotkeySet: (which, hotkey) => {
      settings = settingsStore.setHotkey(settings, which, hotkey);
      keyListener.setHotkeys(settings);
      updateTray();
    },
    onAccessibilityChange: () => updateTray(),
  }).then(() => {
    if (markShown && !settings.onboardingShown) {
      settings = settingsStore.setField(settings, 'onboardingShown', true);
    }
    updateTray();
  });
}

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
  tray.setTitle('');

  counterWindow.update({ texts, imgs, visible: !!active && wisprRunning });

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
    { label: 'Paste mode', submenu: buildPasteModeSubmenu() },
    { label: `Paste delay: ${settings.pasteDelayMs}ms`, submenu: buildPasteDelaySubmenu() },
    { type: 'separator' },
    { label: 'Clear queue', click: () => { queue.clear(); updateTray(); } },
    { type: 'separator' },
    { label: 'Welcome tour…', click: () => runOnboarding(false) },
    { label: 'Quit', click: () => app.quit() }
  );

  tray.setContextMenu(Menu.buildFromTemplate(items));
}

function buildPasteModeSubmenu() {
  const modes = [
    { value: 'segmented', label: 'Segmented (inline text + images)' },
    { value: 'batch', label: 'Batch (text first, images at end)' },
  ];
  return modes.map((m) => ({
    label: m.label,
    type: 'radio',
    checked: settings.pasteMode === m.value,
    click: () => setSetting('pasteMode', m.value),
  }));
}

function buildPasteDelaySubmenu() {
  return settingsStore.PASTE_DELAY_OPTIONS.map((ms) => ({
    label: `${ms}ms`,
    type: 'radio',
    checked: settings.pasteDelayMs === ms,
    click: () => setSetting('pasteDelayMs', ms),
  }));
}

function setSetting(key, value) {
  settings = settingsStore.setField(settings, key, value);
  updateTray();
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

async function pollWispr() {
  try {
    const now = await wispr.isRunning();
    if (now !== wisprRunning) {
      wisprRunning = now;
      updateTray();
    }
  } catch (_) { /* ignore transient ps errors */ }
}

app.on('will-quit', () => {
  keyListener?.stop();
  engine?.stop();
  counterWindow.destroy();
  if (wisprPollTimer) clearInterval(wisprPollTimer);
});

app.on('window-all-closed', (e) => e.preventDefault());
