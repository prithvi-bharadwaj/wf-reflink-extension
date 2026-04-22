# RefLink

Clipboard reference injector for Wispr Flow. Copy links/images while dictating, and they auto-replace reference words ("this", "here") in your transcription.

## How it works

1. Press `Cmd+Shift+R` to start capture mode
2. Copy links/images as you dictate (each Cmd+C becomes a numbered reference)
3. Speak naturally: "Hey, **this** is a cool project. **This** is another one."
4. Wispr Flow finishes -- RefLink intercepts the transcription on the clipboard
5. Each "this" gets replaced with the corresponding copied link, in order
6. The paste lands with links already embedded

## Run

```
npm install
npm start
```

## Architecture

```
ClipboardEngine (polls every 100ms)
       |
       v
  [clipboard change detected]
       |
       ├─ capturing=false → ignore
       |
       ├─ looks like a normal copy → push to ReferenceQueue
       |
       └─ looks like transcription (TranscriptionDetector) →
              ReferenceReplacer swaps trigger words with queued refs →
              clipboard.writeText(modified) →
              Wispr Flow's Cmd+V pastes the modified version
```
