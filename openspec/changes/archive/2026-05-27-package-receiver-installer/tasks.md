## 1. OpenSpec

- [x] 1.1 Create proposal, design, tasks, and spec deltas for `package-receiver-installer`.
- [x] 1.2 Validate `package-receiver-installer` with strict OpenSpec validation.

## 2. Windows Runtime Helpers

- [x] 2.1 Add a JS helper for receiver runtime paths, config checks, PID metadata, process inspection, and Task Scheduler command generation.
- [x] 2.2 Add a JS CLI used by Windows scripts for install/status/start planning and PID metadata operations.
- [x] 2.3 Add tests for helper config checks, stale/live PID handling, command generation, and dry-run output.

## 3. PowerShell Scripts And NPM Commands

- [x] 3.1 Add Windows PowerShell scripts for install/check, start, stop, status, autostart on, and autostart off.
- [x] 3.2 Add npm scripts for Windows-only receiver install/start/stop/autostart commands.
- [x] 3.3 Ignore local runtime logs and PID metadata in git.

## 4. Documentation

- [x] 4.1 Update `docs/local-message-receiver.md` with Windows first-run, start/stop, autostart, status/control, logs, and cleanup instructions.
- [x] 4.2 Update `AGENTS.md` current progress, common commands, and packaging direction.

## 5. Verification

- [x] 5.1 Run `npm test`.
- [x] 5.2 Run `openspec validate package-receiver-installer --strict`.
