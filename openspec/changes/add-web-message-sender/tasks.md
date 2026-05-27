## 1. Sender UI

- [x] 1.1 Add a static root web sender page with token, text, intent, send, clear, loading, and status controls.
- [x] 1.2 Implement frontend API helpers for `getSendToken()`, `createMessage(type, text, options)`, and `clearSticky()`.
- [x] 1.3 Ensure the page is usable on mobile and desktop widths without adding frontend dependencies.

## 2. Documentation and Project Notes

- [x] 2.1 Document web sender usage, token storage, manual checks, and receiver-token warning.
- [x] 2.2 Update `AGENTS.md` current progress and next-change notes.

## 3. Verification

- [x] 3.1 Run `npm test`.
- [x] 3.2 Run `openspec validate add-web-message-sender --strict`.
