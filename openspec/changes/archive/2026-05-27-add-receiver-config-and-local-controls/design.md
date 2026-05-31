## Context

The receiver already owns the hard parts of display behavior: polling the cloud API, writing K20 GT text, acking only after local write, restoring the baseline after remote display ends, honoring receiver-local DND, consuming a one-shot control file, and reporting display status. The remaining friction is local operation. A normal user still has to maintain many environment variables and manually write `receiver-control.json`.

This change keeps the receiver as a Node.js script, but introduces stable local surfaces that a later tray app or installer can call: a local config file and a small control CLI.

## Goals / Non-Goals

**Goals:**

- Allow daily receiver startup from `receiver.config.json` plus optional environment overrides.
- Provide npm scripts for common local controls: status, DND on/off, dismiss current, and restore.
- Preserve the existing one-shot control file as the receiver's local command transport.
- Keep token handling explicit and avoid committing local secrets.
- Cover config merge, malformed config, and CLI control behavior with tests.

**Non-Goals:**

- No Electron/Tauri/tray UI.
- No Windows installer, service, task scheduler, or autostart.
- No change to web DND authority.
- No multi-user, multi-device, login, or message scheduler redesign.

## Decisions

### Configuration Precedence

Use `env > receiver.config.json > defaults`.

Environment variables remain the strongest override because production scripts, CI, and one-off debugging frequently rely on process-level overrides. The config file carries local daily defaults. Missing config files are treated as empty configuration. Malformed JSON fails clearly at startup or CLI invocation.

### Config File Shape

Use camelCase JSON fields:

- `apiBaseUrl`
- `receiverToken`
- `sendToken`
- `pollIntervalMs`
- `textLimit`
- `restoreOnEmpty`
- `restoreLyric`
- `restoreScreenState`
- `transientRestoreDelayMs`
- `dnd`
- `controlFile`
- `logLevel`

`sendToken` is included for local `status` reads because `GET /api/display/status` is sender-token protected. It is local-only and must not expose `RECEIVER_TOKEN` to the web.

### Control CLI Transport

The CLI writes the configured one-shot control file for commands the running receiver must execute. This keeps exactly one receiver code path for DND and dismiss semantics. `restore` becomes a real control command handled by the receiver loop instead of a fake CLI-side display write, so it respects the same configured restore helper and clears the local display session only after restore succeeds.

### Status CLI

`receiver:status` reads local config, requires `apiBaseUrl` and `sendToken`, and calls `GET /api/display/status`. It prints a compact text summary: receiver online/DND/status, current display, current sticky, and transient queue summary. It does not use or expose `receiverToken`.

## Risks / Trade-offs

- Config now has two naming systems, env vars and JSON fields. Mitigation: keep mapping explicit and test precedence.
- `receiver.config.json` contains local secrets. Mitigation: ignore it in git and provide `receiver.config.example.json`.
- CLI commands are one-shot files processed on the next receiver tick, not immediate IPC. Mitigation: document that the receiver must be running and keep this interface simple for later tray reuse.
- Manual restore can clear the receiver's local active session even if the server still has sticky state. Mitigation: document it as a local display release, not a server dismiss; the next non-DND poll may show server targets again.
