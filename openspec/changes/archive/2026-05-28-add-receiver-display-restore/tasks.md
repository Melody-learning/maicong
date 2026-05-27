## 1. OpenSpec

- [x] 1.1 Create proposal, design, tasks, and local-message-receiver spec delta for display restore.
- [x] 1.2 Validate `add-receiver-display-restore` with strict OpenSpec validation.

## 2. Screen Writer

- [x] 2.1 Add shared helpers for lyric enable/disable, screen-state writes, preset restore, and combined display restore.
- [x] 2.2 Preserve existing `setScreenText()` and `npm run screen -- "文本"` behavior.

## 3. Receiver

- [x] 3.1 Parse restore-related receiver environment variables with safe defaults and validation.
- [x] 3.2 Add local display session state and restore-on-empty transition handling.
- [x] 3.3 Ensure sticky, transient, write-failure, ack-failure, and restore-failure behavior match the design.

## 4. Tests

- [x] 4.1 Add unit tests for null/no-active, null/active, consecutive null, sticky, transient/null, transient/sticky, write failure, restore failure, and restore config parsing.
- [x] 4.2 Run `npm test`.

## 5. Documentation

- [x] 5.1 Update `docs/local-message-receiver.md` with restore behavior and environment variables.
- [x] 5.2 Update `K20GT_RESEARCH.md` with the receiver restore sequence.
- [x] 5.3 Update `AGENTS.md` current progress and next change ordering.
