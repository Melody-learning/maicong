## Why

Remote messages now work end to end, but the receiver still behaves like a one-way display takeover: it can write custom text, but it does not yet know how to release the screen back to the K20 GT's native lyric and preset/time display flow. This change creates a narrow local probing track to identify script-level restore commands before adding receiver behavior.

## What Changes

- Add bounded local probes for turning lyric display off and back on through HID commands, including observable behavior while music is playing.
- Add bounded `cmd 9` / screen-state probes around known and nearby payloads to find or narrow a command that returns to personalized preset/time baseline display.
- Add a release probe that starts from remote custom-text foreground and compares lyric re-enable, baseline screen-state candidates, and known custom-text recovery.
- Record visible observations and recommended restore sequence in project research notes.
- Keep all work local, finite, manually observable, and outside the official `MCHOSE HUB` installation directory.

## Capabilities

### New Capabilities

- `display-restore-mode-probing`: Defines restore-mode probing scope, safety rules, command candidates, visible evidence, and documentation expectations for releasing remote K20 GT display takeover.

### Modified Capabilities

- None.

## Impact

- Affected files: `k20gt-probe.js`, `lib/k20gt-screen-writer.js`, `K20GT_RESEARCH.md`, `AGENTS.md`, and OpenSpec change artifacts.
- Affected systems: local HID writes to the connected `MCHOSE K20 GT` through `node-hid`.
- No cloud API, receiver polling behavior, web sender, tray app, startup packaging, or official client directory changes are included.
