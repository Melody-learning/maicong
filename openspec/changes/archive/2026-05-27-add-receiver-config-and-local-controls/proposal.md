## Why

The receiver is now capable enough for day-to-day display ownership, but running it still feels like an engineering tool: users must keep several environment variables straight and hand-write JSON control files. This change makes the local receiver easier to configure and control from scripts, while keeping the current receiver-local DND authority and leaving tray/installer work for a later package-focused change.

## What Changes

- Add local `receiver.config.json` support for receiver runtime settings, with environment variables continuing to override file values.
- Add `receiver.config.example.json` and ignore real local receiver config in git.
- Add a local receiver control CLI and npm scripts for status, DND on/off, dismiss current, and restore.
- Keep the existing one-shot control-file mechanism as the receiver-facing control transport so future tray/installer work can reuse it.
- Update receiver startup, docs, and tests so missing config files are harmless, malformed config files are clear failures, and token handling remains explicit.

## Capabilities

### New Capabilities

- `receiver-config-and-local-controls`: Local receiver configuration file and CLI control surface for day-to-day operation.

### Modified Capabilities

- `local-message-receiver`: Add config-file precedence, local control CLI behavior, and manual restore control semantics.

## Impact

- Affected receiver config and loop code in `lib/local-message-receiver.js` and `k20gt-receiver.js`.
- New local CLI entrypoint, npm scripts, ignored real config, and example config.
- Tests for config merge precedence, missing/malformed config files, control command writes, and status requests.
- Documentation updates in `docs/local-message-receiver.md`, `.env.example`, and `AGENTS.md`.
