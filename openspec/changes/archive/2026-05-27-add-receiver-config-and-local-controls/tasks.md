## 1. OpenSpec

- [x] 1.1 Create proposal, design, tasks, and spec deltas for local receiver config and controls.
- [x] 1.2 Validate `add-receiver-config-and-local-controls` with strict OpenSpec validation.

## 2. Receiver Configuration

- [x] 2.1 Add `receiver.config.json` loading, validation, and `env > config file > defaults` merge behavior.
- [x] 2.2 Update receiver startup to use config-file-aware loading without crashing when the file is absent.
- [x] 2.3 Add `receiver.config.example.json` and ignore real `receiver.config.json`.

## 3. Local Control CLI

- [x] 3.1 Add `k20gt-receiver-control.js` for status, DND on/off, dismiss, and restore commands.
- [x] 3.2 Add npm scripts for `receiver:status`, `receiver:dnd:on`, `receiver:dnd:off`, `receiver:dismiss`, and `receiver:restore`.
- [x] 3.3 Extend receiver control-file processing to support an explicit restore command.

## 4. Tests

- [x] 4.1 Add tests for config file merge precedence, missing config file, malformed config file, and env overrides.
- [x] 4.2 Add tests for control CLI JSON writes and status CLI display-status request behavior.
- [x] 4.3 Run `npm test`.

## 5. Documentation

- [x] 5.1 Update `docs/local-message-receiver.md` with config file and CLI usage.
- [x] 5.2 Update `.env.example` and `AGENTS.md` with the new local receiver experience.
- [x] 5.3 Run `openspec validate add-receiver-config-and-local-controls --strict`.
