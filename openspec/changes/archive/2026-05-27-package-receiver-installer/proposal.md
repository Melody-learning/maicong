## Why

The receiver can now poll, write, restore, dismiss, report status, and read local config, but daily use still depends on a developer-style foreground terminal. This change provides a first Windows-native script-level runtime so the receiver can be started, stopped, checked, and optionally launched at login without building a full tray app or installer yet.

## What Changes

- Add a Windows PowerShell script surface under `scripts/windows/` for install/config checks, background start, stop, status, autostart registration, and autostart removal.
- Add a small JS runtime helper for PID/log/task-scheduler command generation so the core behavior is unit-testable and reusable by later tray packaging.
- Add npm scripts for Windows receiver install/start/stop/autostart commands.
- Store local runtime files in ignored paths, including receiver logs and PID metadata.
- Update local receiver documentation and project notes with first-run, start/stop, autostart, control, and cleanup workflows.
- Keep the existing receiver process, config file shape, cloud API state machine, and web DND authority unchanged.

## Capabilities

### New Capabilities
- `receiver-windows-runtime`: Windows script-level receiver runtime management, background process tracking, logs, and login autostart.

### Modified Capabilities
- `local-message-receiver`: Add packaged-runtime expectations for log-safe startup and config checks without changing polling, display, or control semantics.

## Impact

- New files under `scripts/windows/` and `lib/` for Windows runtime helpers.
- `package.json` npm scripts for Windows-only receiver runtime management.
- `.gitignore` additions for logs and local runtime metadata.
- Tests for helper command generation, config checking, PID handling, and dry-run behavior.
- Documentation updates in `docs/local-message-receiver.md` and `AGENTS.md`.
