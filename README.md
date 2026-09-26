# Bloom Focus

Bloom Focus is a local-first Vue 3 focus and break timer built for the Bloom Productivity System assignment. It keeps honest session history in IndexedDB and can append idempotent Markdown events to a user-selected Obsidian vault.

## Features

- Focus and break timers with start, pause, resume, cancel, early completion, and automatic zero completion
- Paused time excluded from actual active duration
- Editable custom durations and the suggested `25/5, 25/5, 30/10` sequence
- Active-timer recovery after closing, including an explicit elapsed-session prompt
- IndexedDB session history, settings, cached tasks, active timer, and pending sync queue
- Bloom Tasks reconstruction from append-only vault records, plus typed activity fallback
- Append-only, event-ID-guarded daily Markdown at `Bloom Productivity/Bloom Focus/YYYY/MM/YYYY-MM-DD.md`
- Three animated illustrated themes, reduced-motion support, generated offline ambient audio, optional completion chime and notifications
- Five-stage Monday-local weekly flower based only on unique completed focus sessions
- Installable offline PWA

## Run

```bash
npm install
npm run dev
```

## Verify

```bash
npm test
npm run build
```

The tests cover the public seams for timer/state/duration, Markdown event formatting, IndexedDB queue/persistence, and weekly flower calculation.

## Obsidian setup

Open **Vault** in the app, choose the root of an Obsidian vault (or another folder), and grant read/write permission. Bloom Focus creates its own predictable folders. If permission is unavailable, actions still succeed locally and the pending event count remains visible. Reconnect and use **Retry pending** later; each event is verified by its stable marker before being marked synchronized.

Bloom Tasks selection expects the sibling app's append-only files under `Bloom Productivity/Bloom Tasks`. If these records are unavailable, type an activity instead.

## Browser support and privacy

Core timer/history/PWA behavior works in modern browsers. Obsidian folder access uses the File System Access API and targets desktop Chrome/Edge. Directory handles and all productivity data stay on the device. Spotify is only an external link; no Spotify authentication is used.
