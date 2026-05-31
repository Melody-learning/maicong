## Why

The Windows receiver runtime is now usable for daily operation, but handing it to a specific non-developer user still requires too much project-shaped setup. This change creates a private, preconfigured receiver bundle so one trusted target machine can run install/start/stop/status/autostart/DND/dismiss/restore from double-clickable scripts without exposing secrets in git.

## What Changes

- Add a bundle preparation command that creates an ignored Windows distribution folder such as `dist/k20gt-receiver-windows/`.
- Generate double-clickable `.cmd` wrappers for install, start, stop, status, autostart on/off, DND on/off, dismiss, and restore.
- Include a preconfigured private `receiver.config.json` in the generated bundle by copying an existing ignored local config or writing values provided through local environment/arguments.
- Reuse the existing Node receiver, config loader, local control CLI, Windows runtime helper, PowerShell scripts, PID checks, logs, and Task Scheduler autostart behavior.
- Document the private-bundle workflow, including that the generated bundle contains secrets and must not be committed or uploaded publicly.
- Keep status/install output token-redacted and keep `receiverToken` and `sendToken` as separate credentials.

This is a Phase 1.5 packaging layer between the script runtime and a future tray app. It does not change receiver behavior, cloud message scheduling, or API authentication semantics.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `receiver-windows-runtime`: Add private preconfigured bundle preparation and generated double-click Windows command wrappers while preserving the existing runtime semantics.

## Impact

- New bundle generator code under `scripts/` and/or `lib/`, plus npm script entrypoint.
- Generated output under ignored `dist/`.
- `.gitignore` update for generated bundle artifacts if needed.
- Tests for bundle generation, config copy/write behavior, command wrapper targets, and token redaction.
- Documentation updates in `docs/local-message-receiver.md` and project notes in `AGENTS.md`.
