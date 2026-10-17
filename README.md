# Macro Studio

Macro Studio is a local-first Electron + React desktop automation studio. The current V1 foundation includes a secure preload boundary, persisted workflow editor, sequential graph validation, action library, inspector, local run history, and settings surface.

## Development

```bash
npm install
npm run dev
```

Run the validation tests with `npm test` and build the renderer/main process with `npm run build`.

## Architecture

- `src/` contains the renderer UI, shared workflow types, and validation.
- `electron/main.ts` owns the BrowserWindow and privileged external URL opening.
- `electron/preload.ts` exposes only a purpose-specific API.
- Workflow and execution records currently persist in browser local storage so the app remains usable without an account or cloud service. Stored JSON is parsed defensively and reset safely if it becomes malformed.

## Current execution behavior

The sequential execution engine validates the graph before every run and reports running, succeeded, failed, and cancelled step states. Wait actions are asynchronous and cancellable, website actions use the validated Electron URL bridge, and notification actions request browser notification permission. Application and command nodes are intentionally blocked until the explicit desktop approval and native adapter layer is implemented; they fail with an actionable message rather than recording a false success.

## Known limitations

The editor currently models and validates a sequential path. Full OS adapters (application launch, approved child processes, cancellable waits, notifications), SQLite migrations, and packaged installer signing are the next integration layer; no unsupported capability is represented as successful execution.
