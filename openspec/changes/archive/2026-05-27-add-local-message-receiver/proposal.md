## Why

The cloud relay API is now implemented, but the project still needs the local bridge that turns scheduled remote messages into actual K20 GT screen writes. This change completes the first end-to-end validation path while keeping device behavior conservative because long-text and display-layer probing is still ongoing.

## What Changes

- Add a local Node.js receiver process that polls `GET /api/messages/next` with `RECEIVER_TOKEN`.
- Reuse the existing K20 GT HID screen-write capability to display returned `message.text`.
- Ack messages with `POST /api/messages/{id}/ack` only after local screen writing succeeds.
- Keep `null` responses non-invasive: no screen write and no device state change.
- Add environment-based receiver configuration for API base URL, receiver token, poll interval, and simple logging/retry behavior.
- Support graceful Ctrl+C shutdown of the polling loop.
- Add tests for receiver scheduling behavior and error resilience.
- Refactor screen-writing code into a shared module if needed while preserving `npm run screen -- "文本"`.
- Document receiver setup and update project status.
- Exclude tray app, Windows service, autostart, sender UI, bot integrations, pause/do-not-disturb UX, multi-device/user support, and long-text/lyrics/image protocol experiments.

## Capabilities

### New Capabilities

- `local-message-receiver`: Defines the local polling receiver behavior, configuration, screen-write/ack ordering, error handling, and graceful shutdown for the first remote-to-device bridge.

### Modified Capabilities

- None.

## Impact

- Affected code: new receiver script/module, shared screen writer module, package scripts, receiver tests, and documentation.
- Affected APIs: consumes the existing remote message API contract without changing it.
- Affected dependencies: no new runtime dependency expected; use Node 18+ native `fetch`.
- Affected systems: local machine connected to `MCHOSE K20 GT`; no official `MCHOSE HUB` installation files are modified.
