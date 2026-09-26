# Bloom Focus

Bloom Focus is a local-first Pomodoro and time-tracking application for students. It will support focus sessions, breaks, flexible durations, task or activity links, session recovery, ambient themes, weekly flower progress, and append-only Markdown history in a user-selected Obsidian vault.

> **Current status:** Step 4 project setup. The Vue application builds and runs, but the assignment features are not implemented yet.

## Prerequisites

- Node.js 22 or a compatible current Node.js release
- npm
- Desktop Chrome or Edge for the planned Obsidian folder integration

## Setup from a clean clone

```bash
git clone git@github.com:frosopatsalou/bloom-focus.git
cd bloom-focus
npm install
```

## Run locally

```bash
npm run dev
```

Vite prints the local development address in the terminal.

## Production build

```bash
npm run build
npm run preview
```

The production files are generated in `dist/`.

## Dependencies

### Application

- Vue 3 — user-interface components
- Pinia — timer, session, settings, and history state

### Development

- Vite — local development and production builds
- `@vitejs/plugin-vue` — Vue single-file component support
- Sass — SCSS compilation

Exact installed versions are recorded in `package.json` and `package-lock.json`.

## Planned local storage

Session history, active timer recovery data, settings, weekly flower state, cached Bloom Tasks information, and pending Obsidian events will be stored locally in IndexedDB. Core timer actions must continue to work offline.

## Planned Obsidian vault configuration

The finished app will provide a **Connect vault** action. The user will select an Obsidian vault or allowed folder through the browser directory picker.

Bloom Focus will append Markdown events under:

```text
Bloom Productivity/
└── Bloom Focus/
    └── YYYY/
        └── MM/
            └── YYYY-MM-DD.md
```

Planned event types:

- `focus.started`
- `focus.completed`
- `focus.cancelled`
- `break.started`
- `break.completed`
- `break.cancelled`

Completed and cancelled records will include planned duration, actual active duration, timestamps, status, and the linked task or typed activity. If the vault is unavailable, events will remain in a visible local pending queue until successfully verified in the vault.

## Assignment requirements

The application must eventually:

- work offline;
- save data locally;
- start, pause, stop, and complete focus sessions;
- support breaks and editable durations;
- connect sessions to a task or short activity;
- restore an active timer after closing and reopening;
- review completed sessions;
- write append-only Markdown history to a user-selected Obsidian vault.

## Git workflow

Commit after each small, working milestone. Before pushing, run:

```bash
npm run build
```

Important milestones should be tested again from a clean clone.
