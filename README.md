# Macro Studio

Macro Studio is a local-first Electron + React desktop automation studio. The current V1 foundation includes a secure preload boundary, persisted workflow editor, sequential graph validation, action library, inspector, local run history, and settings surface.

## Development

```bash
npm install
npm run dev
```

Run the validation tests with `npm test` and build the renderer/main process with `npm run build`.

## Build a macOS DMG

On macOS, create an unsigned DMG with:

```bash
npm run dist
```

The DMG is written to the `release/` directory. To build only for a specific
architecture, use `npm run build` followed by one of:

```bash
npx electron-builder --mac dmg --arm64
npx electron-builder --mac dmg --x64
```

The packaged app is unsigned unless Apple signing and notarization credentials
are configured. macOS may require choosing **Open** from the app's context menu
the first time it is launched.

## Architecture

- `src/` contains the renderer UI, shared workflow types, and validation.
- `electron/main.ts` owns the BrowserWindow and privileged external URL opening.
- `electron/preload.ts` exposes only a purpose-specific API.
- Workflow and execution records currently persist in browser local storage so the app remains usable without an account or cloud service. Stored JSON is parsed defensively and reset safely if it becomes malformed.
- Workflows can be exported to and imported from validated JSON files for backup, review, and transfer between local installations.
- Run history can be searched and cleared from the Observability view; deleting a workflow also removes its associated local run records.
- Workflows can be duplicated from the dashboard with remapped node connections, and dashboard search also matches workflow descriptions.
- Run history supports status filters for quickly isolating completed, failed, cancelled, or in-progress runs.
- The builder supports undo/redo with keyboard shortcuts, ⌘/Ctrl+Enter to run, Escape to cancel, and zoom controls for large workflow canvases.
- A command palette opens with ⌘/Ctrl+K, the action library is searchable, invalid workflows show a live health badge, and Focus mode expands the canvas for complex automations.
- The app includes a local sign-in/sign-up gateway with Web Crypto password hashing, session persistence, a profile surface, and sign-out. It is intentionally offline and does not claim to replace a hosted identity provider.

## Current execution behavior

The sequential execution engine validates the graph before every run and reports running, succeeded, failed, and cancelled step states. Wait actions are asynchronous and cancellable, website and file/folder actions use validated Electron bridges, copy-text actions use the browser clipboard API, current-date actions return a localized or ISO timestamp, and play-sound/play-music actions open the selected audio file with the operating system's default audio player. Notification actions request browser notification permission. Command nodes remain intentionally blocked until explicit desktop execution approval is implemented; they fail with an actionable message rather than recording a false success.

## Known limitations

The editor currently models and validates a sequential path. In-app audio controls such as pause, resume, and volume, approved child processes, SQLite migrations, and packaged installer signing are the next integration layer; no unsupported capability is represented as successful execution. Branching and parallel execution are intentionally rejected until the graph model supports them.
