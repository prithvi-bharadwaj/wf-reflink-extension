# RefLink

**Clipboard reference injector for [Wispr Flow](https://wisprflow.ai).** Copy links and images while you dictate — RefLink swaps them into your transcription wherever you say "inserted link" or "embedded image."

Say this:

> "Check out **inserted link** — I love the header on **inserted link**. Here's a screenshot: **embedded image**."

Get this:

> "Check out https://github.com/x/y — I love the header on https://stripe.com. Here's a screenshot: 🖼️"

## Features

- **Auto-capture** — detects Wispr Flow and starts a session on your hotkey, no extra clicks
- **Links + images** — each `Cmd+C` during a session becomes a numbered reference
- **Two paste modes**
  - *Segmented* — references land inline, exactly where you said the trigger word
  - *Batch* — text first, images appended at the end (fallback for stubborn apps)
- **Configurable hotkeys** — hold mode (press-and-hold) or toggle mode (tap to start/stop)
- **Menu-bar only** — no Dock icon. The tray glyph is `[ ]` while idle; the dot pulses while waiting for a copy and stays solid once the queue has refs
- **Tunable paste delay** — adjust timing if an app drops keystrokes

## Requirements

- macOS (Apple Silicon)
- Node.js 18+
- [Wispr Flow](https://wisprflow.ai) installed and running
- Accessibility permission (macOS prompts on first run)

## Install & Run

```bash
npm install
npm start
```

Grant Accessibility access when macOS prompts: `System Settings → Privacy & Security → Accessibility`. Then click **Retry after granting** in the tray menu.

## Build a real `.app`

```bash
npm run build
# → dist/RefLink-darwin-arm64/RefLink.app
```

Drag `RefLink.app` into `/Applications` and launch from Spotlight. It auto-registers as a login item on first launch (hidden, menu-bar only) and runs the welcome tour the first time.

The build pipeline regenerates `icon.icns` from [scripts/make-icon.js](scripts/make-icon.js) every time, so the bracket-dot identity stays in sync with the tray glyph.

## Distribute to friends

This is unsigned and unnotarized — the recipient gets a Gatekeeper warning the first time and has to right-click → Open. That's the cost of skipping a $99/year Apple Developer account; it's totally fine for personal sharing.

```bash
npm run release
# → dist/RefLink-arm64.zip
```

Upload `dist/RefLink-arm64.zip` to a [GitHub release](https://github.com/prithvi-bharadwaj/reflink/releases). Recipients:

1. Download and unzip — Finder reveals `RefLink.app`.
2. Drag it to `/Applications`.
3. **First launch:** right-click `RefLink.app` → **Open** → confirm. (After that, normal launch works.)
4. Grant Accessibility when prompted (`System Settings → Privacy & Security → Accessibility`).
5. The welcome tour walks through hotkey setup. Done.

Apple Silicon Macs only.

## How it works

1. RefLink listens for your configured hotkey in the background.
2. When you trigger it *and* Wispr Flow is running, a capture session starts — the tray dot starts pulsing.
3. Every `Cmd+C` during the session gets queued as a reference.
4. Dictate naturally, using trigger phrases where you want each reference inserted.
5. When Wispr Flow pastes its transcription, RefLink intercepts the clipboard, swaps trigger phrases for queued references, and repastes.

Copies made *before* the session are ignored. One queue per session.

## Hotkeys

Click the tray icon to configure:

- **Hold mode** — hold while dictating, release to end. Unbound by default — record whatever key you use for Wispr Flow hold-to-talk (e.g. `Fn`).
- **Toggle mode** — tap to start, tap again to stop. Default: `⌥ Space`.

Press `Esc` in the recorder dialog to cancel.

## Architecture

```
KeyListener (uiohook-napi)
   │
   ├── hold-down / toggle-press (1st)
   │     └─→ Session.startIfWisprRunning
   │           ├─ Wispr running? → clear queue, set active
   │           └─ else → ignore
   │
   └── hold-up / toggle-press (2nd)
         └─→ Session.arm() — wait ≤15s for Wispr's transcription

ClipboardEngine (100ms poll)
   │
   └── on change → Session.handleClipboardChange
         ├─ inactive → ignore
         ├─ looks like transcription → ReferenceReplacer swaps triggers,
         │    Paster writes modified clipboard and synthesizes Cmd+V
         └─ else → push to reference queue
```

### Source layout

| File | Role |
|------|------|
| [src/main.js](src/main.js) | Electron entry, tray menu, settings persistence |
| [src/session.js](src/session.js) | Session orchestration (start, arm, end) |
| [src/clipboard-engine.js](src/clipboard-engine.js) | 100ms clipboard polling loop |
| [src/key-listener.js](src/key-listener.js) | Global hotkey binding via uiohook |
| [src/reference-queue.js](src/reference-queue.js) | FIFO queue of captured references |
| [src/reference-replacer.js](src/reference-replacer.js) | Trigger-phrase → reference swap logic |
| [src/paster.js](src/paster.js) | Segmented & batch paste engines |
| [src/transcription-detector.js](src/transcription-detector.js) | Distinguishes Wispr output from user copies |
| [src/wispr-process.js](src/wispr-process.js) | Detects whether Wispr Flow is running |
| [src/settings.js](src/settings.js) | Persistent preferences |
| [src/icons.js](src/icons.js) | Bracket-dot tray icon renderer (idle / waiting / active) |
| [src/onboarding-window.js](src/onboarding-window.js) | First-run welcome tour |
| [src/counter-window.js](src/counter-window.js) | Floating queue counter pill |
| [scripts/make-icon.js](scripts/make-icon.js) | Generates `icon.icns` for the `.app` bundle |

## Status

Early, working, vibe-coded. Apple Silicon only. Unsigned — distribute via `npm run release` + GitHub releases for now; auto-update and Apple notarization aren't wired.
