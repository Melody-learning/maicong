# Vercel + Upstash Deployment

This project can deploy the board API and web sender to Vercel with Upstash Redis/Vercel KV-compatible environment variables.

## Required Environment Variables

```text
SEND_TOKEN=<random sender token>
RECEIVER_TOKEN=<random receiver token>
KV_REST_API_URL=<upstash redis rest url>
KV_REST_API_TOKEN=<upstash redis rest token>
```

The API also accepts `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

Optional tuning:

```text
MAX_MESSAGE_CHARS=32
MIN_BOARD_DURATION_SECONDS=1
MAX_BOARD_DURATION_SECONDS=86400
SENDER_RATE_LIMIT_COUNT=10
SENDER_RATE_LIMIT_WINDOW_SECONDS=60
RECEIVER_STATUS_TTL_SECONDS=30
REDIS_KEY_PREFIX=k20gt:remote-board
```

## Local Development

```powershell
npm install
npm run vercel:dev
```

Open `http://localhost:3000/` for the sender page.

For day-to-day development, keep production-compatible values in local `.env` and local-only test overrides in ignored `.env.local`. Use a separate local `SEND_TOKEN`, `RECEIVER_TOKEN`, and dev `REDIS_KEY_PREFIX` in `.env.local` so local tests do not authenticate against or overwrite the production board namespace.

For the private Windows receiver package, `npm run receiver:bundle` uses explicit bundle values or `.env` deployment values by default. It does not copy the root `receiver.config.json` unless `--config-source` is passed, does not load `.env.local` unless `--include-local-env` is passed, and refuses localhost API URLs unless `--allow-localhost` is used for local testing.

## API Smoke Test

Create a board:

```powershell
curl.exe -X POST "$env:REMOTE_MESSAGE_API_BASE_URL/api/board" `
  -H "Authorization: Bearer $env:SEND_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"text\":\"线上测试\",\"durationSeconds\":300}"
```

Read it as the receiver:

```powershell
curl.exe "$env:REMOTE_MESSAGE_API_BASE_URL/api/board" `
  -H "Authorization: Bearer $env:RECEIVER_TOKEN"
```

Report displayed:

```powershell
curl.exe -X POST "$env:REMOTE_MESSAGE_API_BASE_URL/api/board/$boardId/displayed" `
  -H "Authorization: Bearer $env:RECEIVER_TOKEN"
```

Clear it:

```powershell
curl.exe -X DELETE "$env:REMOTE_MESSAGE_API_BASE_URL/api/board" `
  -H "Authorization: Bearer $env:SEND_TOKEN"
```

Check display status:

```powershell
curl.exe "$env:REMOTE_MESSAGE_API_BASE_URL/api/display/status" `
  -H "Authorization: Bearer $env:SEND_TOKEN"
```

Expected:

- `POST /api/board` returns HTTP `201` with `board`.
- `GET /api/board` returns HTTP `200` with either `board` or `board: null`.
- `POST /api/board/{id}/displayed` returns HTTP `200`.
- `DELETE /api/board` returns HTTP `200`.
- `GET /api/display/status` returns receiver summary plus `currentBoard`/`currentDisplay`.
- Legacy `/api/messages` routes return HTTP `410`.

## Receiver Smoke Test

On the receiver machine:

```powershell
npm run receiver
```

The receiver should poll `/api/board`, write only new board ids to the connected `MCHOSE K20 GT` screen, report displayed only after a successful local write, and restore once after the board expires or is cleared.

## Current Verification Scope

The `simplify-remote-display-to-expiring-board` change was verified with automated tests and mocked screen writes/restores. It did not include live K20 GT HID display verification.
