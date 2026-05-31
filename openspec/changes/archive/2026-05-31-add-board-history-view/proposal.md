## Why

The sender page currently shows only the current small blackboard, so the user cannot quickly confirm what was sent recently after the board expires, is cleared, or is replaced. A lightweight recent-history view makes the web sender easier to trust without turning it back into a notification inbox or receiver diagnostics panel.

## What Changes

- Add a token-protected board history read capability that returns recent board records in newest-first order.
- Record newly created board ids in a bounded recent-history index so history can be listed without scanning Redis keys.
- Mark the current active board in history responses with a simple current flag.
- Add a "recent small blackboards" section to the web sender that shows only write time, board text, and a current marker when applicable.
- Keep terminal reasons, receiver display lifecycle, queues, and detailed status states out of the web history UI.

## Capabilities

### New Capabilities

- `board-history`: Recent board history listing for the small-blackboard model.

### Modified Capabilities

- `web-message-sender`: Show a lightweight recent-history list in the browser sender UI.

## Impact

- API/storage: add a history index and a sender-token `GET` endpoint for recent boards.
- Web: add a simple history list and refresh it after status loads, board creation, and board clearing.
- Tests/docs: cover history ordering, current marking, token boundaries, bounded retention, and sender UI rendering.
