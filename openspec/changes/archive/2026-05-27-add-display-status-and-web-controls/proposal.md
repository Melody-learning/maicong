## Why

The remote message loop now has working send, receive, ack, restore, dismiss, and receiver-local DND behavior, but the browser sender still sees only create/clear results. It cannot tell whether the receiver is recently online, whether local DND is active, which remote display target is current, or why an older message stopped being effective.

This change connects the product-level display state across API, receiver, and web sender before packaging the receiver as a tray app or installer.

## What Changes

- Add product-facing message end metadata, including `endedReason`, `endedAt`, and `displayState` in public message responses.
- Add receiver status storage with `dnd`, `lastSeenAt`, `lastStatus`, `lastDisplayMessageId`, `lastDisplayMessageType`, and `remoteDisplayActive`.
- Add `GET /api/display/status` for sender-token status reads.
- Add `POST /api/display/status` for receiver-token status updates.
- Keep receiver-local DND authoritative in this first version; the web sender displays DND but does not remotely toggle it.
- Extend the receiver loop to report status without crashing if status sync fails.
- Extend the web sender with a compact status panel and refresh control using only `SEND_TOKEN`.
- Update docs, tests, `.env.example`, and `AGENTS.md`.

## Capabilities

### New Capabilities

- `display-status`: Cloud-visible receiver/display status summary for the sender UI.

### Modified Capabilities

- `remote-message-api`: Public message responses include product display state and end reason; sticky replace/clear/dismiss and transient ack/dismiss/timeout/TTL use distinct reasons.
- `local-message-receiver`: Receiver reports DND, last seen, current message, and remote display activity to the cloud.
- `web-message-sender`: Browser sender displays receiver online-ish state, DND state, current sticky/current display summary, and pending transient count.

## Impact

- Affected API routes under `api/`.
- Affected remote message storage/model helpers under `lib/remote-message`.
- Affected receiver loop/config under `lib/local-message-receiver.js`.
- Affected browser sender files under `public/`.
- New and updated tests for storage/API status, receiver status sync, and web helper behavior where practical.
- Documentation updates for API, receiver, web sender, and project progress.

## Out of Scope

- Windows installer, tray app, service, or autostart packaging.
- Login, multi-user, or multi-device routing.
- Telegram or WeChat ingress.
- New long-text display strategy.
- Remote DND toggle from the web sender.
- Changes to the official `MCHOSE HUB` installation directory.
