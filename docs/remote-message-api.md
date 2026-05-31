# Remote Board API

The cloud API now models the remote K20 GT display as one expiring board. There is no sticky/transient queue in the active product contract.

## Configuration

- `SEND_TOKEN`: bearer token for sender actions such as `POST /api/board`, `GET /api/board`, `DELETE /api/board`, and `GET /api/display/status`.
- `RECEIVER_TOKEN`: bearer token for receiver actions such as `GET /api/board`, `POST /api/board/{id}/displayed`, `POST /api/board/{id}/dismiss`, and `POST /api/display/status`.
- `MAX_MESSAGE_CHARS`: conservative text length limit, default `32`.
- `MIN_BOARD_DURATION_SECONDS`: minimum board duration, default `1`.
- `MAX_BOARD_DURATION_SECONDS`: maximum board duration, default `86400`.
- `BOARD_HISTORY_LIMIT`: number of recent board ids retained for sender history, default `20`.
- `SENDER_RATE_LIMIT_COUNT` / `SENDER_RATE_LIMIT_WINDOW_SECONDS`: simple sender-side rate limit.

Redis can use either Upstash names or Vercel KV-compatible names:

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
KV_REST_API_URL
KV_REST_API_TOKEN
```

## Endpoints

Create or replace the current board:

```powershell
curl.exe -X POST "http://localhost:3000/api/board" `
  -H "Authorization: Bearer $env:SEND_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"text\":\"今天别熬夜\",\"durationSeconds\":300}"
```

Read the current unexpired board:

```powershell
curl.exe "http://localhost:3000/api/board" `
  -H "Authorization: Bearer $env:SEND_TOKEN"
```

Clear the current board:

```powershell
curl.exe -X DELETE "http://localhost:3000/api/board" `
  -H "Authorization: Bearer $env:SEND_TOKEN"
```

Report that the receiver displayed a board:

```powershell
curl.exe -X POST "http://localhost:3000/api/board/<board-id>/displayed" `
  -H "Authorization: Bearer $env:RECEIVER_TOKEN"
```

Dismiss the current board from the receiver side:

```powershell
curl.exe -X POST "http://localhost:3000/api/board/<board-id>/dismiss" `
  -H "Authorization: Bearer $env:RECEIVER_TOKEN"
```

Read display status:

```powershell
curl.exe "http://localhost:3000/api/display/status" `
  -H "Authorization: Bearer $env:SEND_TOKEN"
```

Read recent board history:

```powershell
curl.exe "http://localhost:3000/api/board/history" `
  -H "Authorization: Bearer $env:SEND_TOKEN"
```

Update receiver status:

```powershell
curl.exe -X POST "http://localhost:3000/api/display/status" `
  -H "Authorization: Bearer $env:RECEIVER_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"dnd\":false,\"remoteDisplayActive\":true,\"lastDisplayBoardId\":\"<board-id>\"}"
```

## Board Shape

Responses expose board summaries with:

```json
{
  "id": "board-id",
  "text": "今天别熬夜",
  "durationSeconds": 300,
  "createdAt": "2026-05-29T00:00:00.000Z",
  "updatedAt": "2026-05-29T00:00:00.000Z",
  "expiresAt": "2026-05-29T00:05:00.000Z",
  "displayedAt": null,
  "lastDisplayedAt": null,
  "endedAt": null,
  "endedReason": null
}
```

`endedReason` can be `expired`, `replaced`, `cleared`, or `dismissed`.

## Board History

`GET /api/board/history` requires `SEND_TOKEN` and returns newest-first recent board summaries:

```json
{
  "boards": [
    {
      "id": "board-id",
      "text": "今天别熬夜",
      "createdAt": "2026-05-29T00:00:00.000Z",
      "isCurrent": true
    }
  ]
}
```

History is a bounded recent-write index, not a permanent archive or lifecycle log. It begins with boards created after this feature is deployed, skips records that no longer exist, and does not require or expose receiver token access. The sender web page uses it only for write time, text, and the neutral current marker.

## Legacy Routes

The old `/api/messages` routes are retired and return HTTP `410` with `messages_api_retired`. Update clients to use `/api/board`.
