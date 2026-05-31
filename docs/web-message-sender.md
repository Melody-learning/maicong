# Web Board Sender

The root web page is a minimal browser sender for the expiring board API. It does not add login, Telegram, WeChat, multi-user support, tray UI, long-text strategy, sound, or TTS.

## Behavior

- The page stores only `SEND_TOKEN`, optionally in browser local storage.
- It never asks for or exposes `RECEIVER_TOKEN`.
- `写上去` calls `POST /api/board` with `text` and `durationSeconds`.
- `清空小黑板` calls `DELETE /api/board`.
- `刷新` calls `GET /api/display/status` and shows receiver online-ish state, receiver-local DND, current board text, and expiration timing.
- The recent-history section calls `GET /api/board/history` with `SEND_TOKEN` and shows only write time, text, and a `当前` marker when the board is still the current unexpired board.

Duration presets are currently 30 seconds, 5 minutes, 30 minutes, and 1 hour. Server validation remains the source of truth for text length and duration bounds.

Recent history is intentionally lightweight. It starts with boards created after the history feature is deployed, keeps only the bounded recent index configured by the API, and does not show receiver diagnostics, ended reasons, display acknowledgements, search, or deletion controls.

## Manual Check

1. Run `npm run vercel:dev`.
2. Open `http://localhost:3000/`.
3. Enter `SEND_TOKEN`.
4. Enter short text and choose a duration.
5. Click `写上去` and confirm the page reports success.
6. Click `刷新` and confirm current board and expiration timing are shown.
7. Confirm the recent-history section shows the write time and text, with `当前` on the current board.
8. Click `清空小黑板` and confirm the empty state is visible and the recent entry is no longer marked `当前`.
9. Try an intentionally wrong token and confirm the page shows `unauthorized` or a readable history-load failure.

This check does not require a live K20 GT. Receiver-to-device display still depends on a connected speaker.
