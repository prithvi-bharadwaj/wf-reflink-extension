# RefLink

Clipboard reference injector for Wispr Flow. Copy links/images while dictating, and they auto-replace reference words ("this", "here") in your transcription.

## How it works

1. RefLink passively listens for your Wispr Flow hotkey.
2. When you trigger Wispr Flow (and Wispr Flow is running), RefLink starts capturing.
3. Copy links/images as you dictate — each `Cmd+C` becomes a numbered reference.
4. Speak naturally: "Hey, **inserted link** is a cool project. **inserted link** is another one."
5. When Wispr Flow finishes dictating, RefLink intercepts the transcription on the clipboard.
6. Each trigger phrase (`inserted link`, `embedded image`, etc.) gets replaced with the next queued reference.
7. The paste lands with links already embedded.

The queue only collects copies **during** a Wispr Flow session. Anything you copied before triggering dictation is ignored.

## Hotkeys

Configurable from the menu-bar icon. Defaults:

- **Hold mode** — hold a key while dictating; session ends on release. *(unbound by default — record your Wispr Flow hold key, e.g. Fn)*
- **Toggle mode** — tap once to start, tap again to stop. *(default: ⌥ Space)*

Click the tray icon → `Hold: …` or `Toggle: …` to record. Press Esc in the recorder to cancel.

## Run

```
npm install
npm start
```

On first run, macOS will prompt for **Accessibility** permission — RefLink needs it to detect your Wispr Flow hotkey. Grant it in `System Settings → Privacy & Security → Accessibility`, then click `Retry after granting` in the tray menu.

## Architecture

```
KeyListener (uiohook-napi)
       |
       ├─ hold:down / toggle:press  →  Session.startIfWisprRunning()  →  Wispr running? → clear queue, active=true
       |                                                                            else → ignore
       |
       └─ hold:up / toggle:press (2nd)  →  Session.arm()  →  wait up to 15s for Wispr's transcription

ClipboardEngine (polls every 100ms)
       |
       v
  [clipboard change]
       |
       └─ Session.handleClipboardChange →
              active=false → ignore
              is transcription (TranscriptionDetector) →
                ReferenceReplacer swaps trigger words with queued refs →
                clipboard.writeText(modified) → Wispr Flow's Cmd+V pastes modified version →
                end session
              otherwise → push to queue
```
