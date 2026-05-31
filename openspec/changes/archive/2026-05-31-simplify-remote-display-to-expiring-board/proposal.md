## Why

The current remote display model has grown into a small notification system with sticky messages, transient queues, display states, and terminal reasons. For the first real product shape, the K20 GT screen is better modeled as a single expiring "small blackboard": one external note at a time, shown until its deadline, then released.

This reduces cloud scheduling, receiver behavior, and sender UI complexity while preserving the safety controls that matter: token auth, length limits, rate limits, receiver-local DND, explicit dismiss, and display restore.

## What Changes

- **BREAKING** Replace the public sticky/transient message API with a single-board API:
  - `POST /api/board` creates or replaces the current board.
  - `GET /api/board` returns the current unexpired board or `null`.
  - `DELETE /api/board` clears the current board.
  - `POST /api/board/{id}/displayed` records that the receiver displayed a board.
  - `POST /api/board/{id}/dismiss` lets the receiver dismiss the current board.
- **BREAKING** Require every board creation request to provide a valid `durationSeconds`; the service must store every active board with an `expiresAt`.
- Remove sticky/transient product semantics, transient FIFO queue scheduling, pending/showing/shown public state transitions, and pending transient status summaries.
- Update the receiver to poll the board API, display only new board ids, avoid rewriting the same active board on every loop, and restore once when the board becomes empty or expired.
- Keep receiver-local DND, local dismiss/restore controls, receiver status reporting, token boundaries, rate limiting, and conservative text limits.
- Update the web sender from "贴上去 / 显示一下" to "写到小黑板" with an explicit duration selection and "清空小黑板".
- Do not change K20 GT HID protocol helpers, probe scripts, or screen-writer command payloads in this change.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `remote-message-api`: Replace sticky/transient message scheduling requirements with single expiring board requirements and new board endpoints.
- `local-message-receiver`: Replace message polling/ack/dismiss semantics with board polling/displayed/dismiss semantics while preserving restore, DND, status sync, and runtime compatibility.
- `web-message-sender`: Replace sticky/transient sender controls and status summaries with a board sender, duration selection, clear action, and board status display.

## Impact

- Affected API routes:
  - Add `api/board/index.js`, `api/board/[id]/displayed.js`, and `api/board/[id]/dismiss.js`.
  - Remove or retire `api/messages/index.js`, `api/messages/next/index.js`, `api/messages/[id]/ack.js`, `api/messages/[id]/dismiss.js`, and `api/messages/clear/index.js`.
- Affected backend modules:
  - `lib/remote-message/model.js`
  - `lib/remote-message/validation.js`
  - `lib/remote-message/redis-storage.js`
  - `lib/remote-message/api.js`
  - `lib/remote-message/config.js`
- Affected receiver modules:
  - `lib/local-message-receiver.js`
  - receiver control/status tests and docs
- Affected sender UI:
  - `public/index.html`
  - `public/app.js`
  - `public/styles.css`
- Affected tests and docs:
  - Remote API/storage/validation tests
  - Local receiver tests
  - Web sender docs and deployment/smoke-test docs
  - `AGENTS.md`
- Hardware impact:
  - No HID protocol behavior changes.
  - Verification for this change is unit/API/UI behavior only; real K20 GT display verification remains unavailable until the speaker is connected.
