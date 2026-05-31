## Context

The current cloud and receiver behavior models remote display as a message scheduler: sticky messages represent an ongoing target, transient messages use a bounded FIFO queue, and status responses expose message display states and ended reasons. That was useful while exploring product shape, but it now creates more business logic than the first "remote small note" experience needs.

The desired product model is a single expiring board. The cloud stores at most one active external display target. The receiver displays that target if it exists and has not expired; otherwise it releases remote occupation using the existing restore helpers. The K20 GT is currently unavailable, so this change should not alter HID payload logic or require real-device verification.

## Goals / Non-Goals

**Goals:**
- Replace the public sticky/transient API with board-oriented endpoints.
- Guarantee every active board has an expiration time.
- Remove transient queue scheduling and sticky fallback behavior from the active product model.
- Make receiver polling idempotent for unchanged board ids so it does not rewrite the same board on every loop.
- Preserve receiver-local DND, dismiss, restore, status reporting, token boundaries, text limits, and rate limiting.
- Update the web sender and docs to use board language and duration selection.
- Verify behavior with unit/API tests and mocked screen writes/restores.

**Non-Goals:**
- No changes to HID command construction, screen writer helpers, probe scripts, or protocol assumptions.
- No real K20 GT smoke test is required for this change.
- No notification inbox, queued reminders, multi-device routing, accounts, Telegram/WeChat entry, or tray UI.
- No attempt to migrate old sticky/transient history into the new board model.

## Decisions

### 1. Use a breaking `/api/board` surface

Use the new board endpoints as the canonical API instead of keeping `/api/messages` as the product-facing contract:

- `POST /api/board`
- `GET /api/board`
- `DELETE /api/board`
- `POST /api/board/{id}/displayed`
- `POST /api/board/{id}/dismiss`

Rationale: keeping `/api/messages` would preserve old names but also preserve old thinking. The product is no longer a message scheduler; it is one current board. A breaking API is acceptable because current clients are under project control.

Alternative considered: keep old endpoints and map `sticky`/`transient` onto board duration. This would reduce route churn, but it leaves confusing external semantics in docs, web UI, receiver logs, and future integrations.

### 2. Store a single active board pointer

Use one active pointer such as `currentBoard` and per-board records such as `board:<id>`.

Creating a board:
- validates text and `durationSeconds`;
- expires/replaces any previous current board;
- stores the new board with `expiresAt`;
- sets `currentBoard` to the new id.

Reading a board:
- cleans up the current pointer if the board is missing or expired;
- returns the board only if it is current and unexpired;
- otherwise returns `null`.

Rationale: this removes sorted sets, showing transient sets, transient queue limits, and scheduling priority logic. Old Redis keys may remain harmlessly orphaned; active code should not read them.

Alternative considered: reuse message records and `currentSticky`. This would minimize storage churn but keeps sticky-specific names inside the core model.

### 3. Require duration at creation

`durationSeconds` is required for `POST /api/board`. The server may expose configured min/max bounds and defaults for UI convenience, but it must not create an active board without `expiresAt`.

Rationale: the small blackboard model depends on automatic release. Requiring duration prevents the remote system from becoming a permanent display owner by accident.

Alternative considered: allow "until cleared". This matches the old sticky behavior but is exactly the product complexity this change is trying to remove.

### 4. Make receiver display idempotent by board id

The receiver should track the last/current displayed board id in its local display session.

Loop behavior:
- DND on: do not fetch or write board content; if remote display is active, attempt restore once.
- No board returned: restore once if remote display is active.
- Same board id already active: do not call `writeScreenText` or `displayed` again; continue status heartbeat.
- New board id: write screen text; after success, call `displayed`; then mark local remote display active.

Rationale: under the current sticky behavior, polling can repeatedly write the same active target. The board model should act like a state synchronizer: write only when the desired external board changes.

Alternative considered: return the current board on every poll and rewrite every time. This is simpler but creates needless HID writes and keeps the old "scheduler keeps asserting ownership" feel.

### 5. Keep restore as receiver adapter behavior

The receiver still needs restore-on-empty and manual restore controls, but this is device occupation cleanup, not product scheduling.

This change should call the existing `restoreDisplay` helper and respect existing receiver restore config. It should not edit `lib/k20gt-screen-writer.js` or probe code.

Rationale: the device has known foreground/cache behavior. Even though the product model becomes simple, releasing the screen after expiry still requires the existing restore sequence.

### 6. Simplify status shape

`GET /api/display/status` should report:
- receiver online-ish state, DND, last seen, last status, remote display active;
- current board summary, if any;
- current receiver-reported display board, if known.

It should no longer report current sticky, pending transient count, or pending transient summaries.

Rationale: the sender UI should answer "is there a current board and when does it expire?" rather than exposing queue/scheduler internals.

## Risks / Trade-offs

- Breaking deployed API clients -> Current clients are project-controlled; update receiver, web UI, docs, and tests in the same change.
- Existing Redis sticky/transient keys may contain old active data -> New code should ignore old scheduling keys; document that old queued messages are abandoned after deploy.
- Receiver cannot verify actual K20 GT display without hardware -> Use mocked `writeScreenText` and `restoreDisplay` tests; record no-hardware verification limitation in docs.
- Same-id no-rewrite may fail to recover if the local user changes the display outside receiver control -> Keep explicit dismiss/restore controls and existing local-takeover boundary; automatic HID detection remains out of scope.
- Requiring duration removes permanent notes -> This is intentional for the simplified model; users can choose a longer allowed duration if needed.

## Migration Plan

1. Add board API routes and board storage behavior.
2. Update receiver client paths and local session tracking.
3. Update web sender controls and status rendering.
4. Update tests for API/storage/receiver/web behavior with mocks only.
5. Update docs and project notes to reflect the single expiring board model.
6. Deploy together so web and receiver use the new board endpoints at the same time.

Rollback strategy: revert this change to restore `/api/messages` behavior. Old sticky/transient Redis keys are not deleted by the migration, but any board created during the new version will not be visible to the old scheduler unless a follow-up migration maps it back.

## Open Questions

- What duration presets should the web sender expose by default? A first pass can use 30 seconds, 5 minutes, 30 minutes, and 1 hour.
- Should `DELETE /api/board` accept both `SEND_TOKEN` and `RECEIVER_TOKEN`, or should receiver-local clear always use `POST /api/board/{id}/dismiss` for id safety? Recommended: allow sender clear with `SEND_TOKEN`; use id-specific dismiss for receiver.
