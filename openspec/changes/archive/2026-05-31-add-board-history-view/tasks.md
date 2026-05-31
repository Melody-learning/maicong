## 1. Storage and API

- [x] 1.1 Add board history retention configuration or a first-version default retention count.
- [x] 1.2 Update board creation storage so each successful board id is added to a bounded newest-first history index.
- [x] 1.3 Add a store method that lists recent board summaries, skips missing records, and marks the current unexpired board with `isCurrent`.
- [x] 1.4 Add `GET /api/board/history` with `SEND_TOKEN` authorization and no receiver-token requirement.

## 2. Web Sender

- [x] 2.1 Add markup and styles for a simple recent small-blackboard history section.
- [x] 2.2 Add browser code to fetch history and render write time, text, and the current marker only.
- [x] 2.3 Refresh history on page load/status refresh, after board creation, and after board clearing.
- [x] 2.4 Show readable empty and history-load-failure states without exposing receiver-token language.

## 3. Tests and Documentation

- [x] 3.1 Add storage/API tests for history ordering, bounded retention, missing-record skipping, current marking, and token rejection.
- [x] 3.2 Add web tests for successful history rendering, empty history, current marker display, and refresh after create/clear.
- [x] 3.3 Update sender/API documentation to describe the lightweight history view and its privacy/retention behavior.
- [x] 3.4 Run `npm test` and `openspec validate add-board-history-view --strict`.
