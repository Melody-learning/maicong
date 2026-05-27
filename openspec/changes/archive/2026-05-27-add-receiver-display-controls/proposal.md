## Why

The receiver can now restore the K20 GT display after remote content naturally ends, but it still treats an active remote sticky as a display target that may be written again after the local user changes the display in MCHOSE HUB. This change makes remote content behave like inserted messages: the current message can be dismissed/read, and Do Not Disturb can block future remote display without changing server-side sticky state.

## What Changes

- Add receiver-token-protected `POST /api/messages/{id}/dismiss`.
- Map dismiss/read into the existing message lifecycle: sticky dismiss expires the sticky, transient dismiss marks the transient shown.
- Track the current remote message in the receiver display session.
- Add receiver-local DND state and a minimal JSON control file for `dismiss`, `dnd on`, and `dnd off`.
- Restore the configured native baseline/lyric switch when dismissing the current message or enabling DND while remote display is active.
- Document that automatic local MCHOSE HUB takeover detection is intentionally deferred until a conservative readback strategy is proven.

## Capabilities

### New Capabilities

- `receiver-display-controls`: Receiver-local display ownership controls, including dismiss/read and Do Not Disturb semantics.

### Modified Capabilities

- `remote-message-api`: Add receiver-side message dismiss/read endpoint and scheduling behavior.
- `local-message-receiver`: Add current-message dismiss, DND behavior, control-file configuration, and restore integration.

## Impact

- Affected API routes under `api/messages`.
- Affected remote message storage and API helpers under `lib/remote-message`.
- Affected receiver loop and config under `lib/local-message-receiver.js` and `k20gt-receiver.js`.
- New and updated tests for API/storage and receiver control behavior.
- Documentation updates for API, local receiver controls, implementation report, `.env.example`, and project progress in `AGENTS.md`.
