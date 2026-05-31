## Context

The receiver is stable enough for daily remote display use, but running `npm run receiver` in a visible developer terminal is still too fragile for someone else's Windows desktop. The previous change created `receiver.config.json` and a local control CLI; this change turns those surfaces into a Windows script runtime that a future tray app or installer can call.

## Goals / Non-Goals

**Goals:**

- Provide Windows scripts for checking configuration, starting the receiver in the background, stopping only the project-managed receiver, viewing status, and managing login autostart.
- Avoid duplicate receiver processes by tracking a project-owned PID file and checking whether the process is still alive.
- Write runtime logs to ignored local files without printing tokens.
- Use a Windows-native autostart mechanism that does not require administrator privileges.
- Keep the scripts simple enough to inspect and use during the current exploration phase.

**Non-Goals:**

- No Electron/Tauri/tray UI.
- No `.exe` or `.msi` packaging.
- No Windows service.
- No admin-required install path or system-wide registration.
- No changes to cloud API scheduling, message states, receiver DND authority, or web status behavior.

## Decisions

### Use Task Scheduler For Login Autostart

Use a per-user Windows Task Scheduler task triggered at user logon. Compared with a Startup shortcut, Task Scheduler provides a named object that scripts can query, update, run, and remove idempotently. It also avoids writing to shell Startup folders and gives clearer status when later tray packaging wants to inspect autostart state. The task is registered for the current user and does not require administrator privileges.

The task action runs PowerShell with `scripts/windows/start-receiver.ps1` from the project root. The start script owns duplicate-process checks and log redirection, so login autostart and manual start share one path.

### Thin PowerShell, Tested JS Helper

PowerShell scripts are kept as thin command wrappers. Core path choices, PID metadata checks, safe command generation, and dry-run summaries live in `lib/receiver-windows-runtime.js`, with a Node CLI in `scripts/windows/receiver-runtime-cli.js`. This keeps the Windows behavior testable with Vitest even when Task Scheduler itself is not exercised in CI.

### PID File And Project Ownership

Starting writes `.receiver/receiver.pid.json` with PID, start time, project root, script path, and log path. Stop reads that metadata and only stops the matching PID if the command line looks like this project's `k20gt-receiver.js`. This is intentionally conservative: stale PID files are cleaned, but unrelated Node processes are left alone.

### Local Runtime Files

Logs are written to `logs/receiver.log` and runtime metadata to `.receiver/`. Both are ignored by git. The receiver itself still reads `receiver.config.json`; the install/check script verifies that this file exists and can be parsed but never writes real tokens.

### Dry Run / WhatIf

The scripts expose dry-run behavior for install/config checks and generated commands. PowerShell scripts also use `SupportsShouldProcess` where they perform mutating work, so users can inspect changes with `-WhatIf` before starting/stopping/registering.

## Risks / Trade-offs

- Task Scheduler availability varies in locked-down Windows environments. Mitigation: document manual start/stop as the fallback and keep autostart optional.
- PID files can go stale after crashes or reboots. Mitigation: status/start/stop verify live process metadata and clean stale files.
- Node process command-line inspection can be imperfect. Mitigation: require command-line evidence of this project's `k20gt-receiver.js` before stopping a PID.
- Background logs can grow over time. Mitigation: keep the first version simple and document log cleanup; rotation can be added later if long-running logs become noisy.
- PowerShell execution policy may block scripts. Mitigation: npm scripts invoke `powershell -ExecutionPolicy Bypass -File ...` for this process only, and docs also show direct commands.
