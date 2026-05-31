## 1. API and Storage Model

- [x] 1.1 Replace the remote message model constants/public shape with a single board shape containing id, text, durationSeconds, createdAt, updatedAt, expiresAt, displayedAt, lastDisplayedAt, endedAt, and endedReason.
- [x] 1.2 Replace create-message validation with board validation that rejects missing/invalid durationSeconds, empty text, over-limit text, and legacy sticky/transient type semantics.
- [x] 1.3 Replace sticky/transient Redis scheduling with a single currentBoard pointer and per-board records.
- [x] 1.4 Implement board create/replace behavior, including marking the previous current board as replaced.
- [x] 1.5 Implement current-board read cleanup so expired/missing boards clear currentBoard and return null.
- [x] 1.6 Implement board displayed reporting without making the board terminal.
- [x] 1.7 Implement sender clear and receiver id-specific dismiss semantics.
- [x] 1.8 Update API config defaults and environment names for board duration bounds.

## 2. API Routes

- [x] 2.1 Add canonical board route handlers for POST/GET/DELETE /api/board.
- [x] 2.2 Add POST /api/board/{id}/displayed with receiver-token authorization.
- [x] 2.3 Add POST /api/board/{id}/dismiss with receiver-token authorization.
- [x] 2.4 Remove, retire, or stop using /api/messages routes and ensure docs/tests no longer depend on sticky/transient endpoints.
- [x] 2.5 Update GET/POST /api/display/status so status responses expose board summaries instead of sticky/transient summaries.

## 3. Local Receiver

- [x] 3.1 Update receiver API client helpers to fetch the current board, report displayed, dismiss board, and read board-oriented display status.
- [x] 3.2 Update display session state to track currentBoardId/currentBoardActive instead of current message type/sticky fields.
- [x] 3.3 Update one-loop receiver behavior so a new board id writes the screen and reports displayed.
- [x] 3.4 Update one-loop receiver behavior so the same active board id does not rewrite the screen or report displayed again.
- [x] 3.5 Update empty-board behavior so restore still runs once after active remote display occupation ends.
- [x] 3.6 Preserve DND, restore, control-file, error resilience, and status-reporting behavior under the board model.
- [x] 3.7 Keep shared K20 GT screen-writer and probe files unchanged except for call-site compatibility if strictly required.

## 4. Web Sender

- [x] 4.1 Replace sticky/transient controls with one board send flow and explicit duration selection.
- [x] 4.2 Replace sticky clear behavior with current-board clear using DELETE /api/board.
- [x] 4.3 Update status rendering to show receiver online/DND, current board text, expiration timing, and empty-board state.
- [x] 4.4 Remove queue, pending transient, sticky, and displayState copy from the page.
- [x] 4.5 Check mobile and desktop layout for the updated controls without requiring a live K20 GT.

## 5. Tests

- [x] 5.1 Update validation tests for board text and duration rules.
- [x] 5.2 Update storage tests for create, replace, expire, read-null, displayed report, clear, dismiss, and rate limit behavior.
- [x] 5.3 Update API tests for board endpoint authorization, payloads, status shape, and legacy endpoint removal/retirement behavior.
- [x] 5.4 Update receiver tests for new board writes, same-board no-rewrite, empty-board restore, DND, dismiss, status reporting, and displayed-report failure.
- [x] 5.5 Update web sender tests or browser smoke instructions for board payloads and status labels.
- [x] 5.6 Run the full automated test suite without requiring the K20 GT to be connected.

## 6. Docs and Runtime Packaging

- [x] 6.1 Update remote API docs from messages/sticky/transient to expiring board endpoints.
- [x] 6.2 Update local receiver docs, deployment docs, and web sender docs for the board model.
- [x] 6.3 Update AGENTS.md with the new single expiring board product decision and note that this change has no real-device verification.
- [x] 6.4 Regenerate the receiver bundle and zip after receiver/runtime-impacting changes.
- [x] 6.5 Ensure generated dist artifacts remain git-ignored and no token values are printed or committed.

## 7. Validation

- [x] 7.1 Run npm test.
- [x] 7.2 Run openspec validate simplify-remote-display-to-expiring-board --strict.
- [x] 7.3 Record in docs that verification covered API/storage/receiver/web behavior with mocked screen writes/restores, not live K20 GT HID display.
