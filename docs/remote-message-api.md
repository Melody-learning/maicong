# Remote Message API

This document describes the cloud relay API. The first local receiver is documented separately in `docs/local-message-receiver.md`, and the minimal browser sender is documented in `docs/web-message-sender.md`.

## Environment Variables

Required:

- `SEND_TOKEN`: bearer token for `POST /api/messages`.
- `RECEIVER_TOKEN`: bearer token for `GET /api/messages/next`, `POST /api/messages/{id}/ack`, and `POST /api/messages/{id}/dismiss`.
- `UPSTASH_REDIS_REST_URL` or `KV_REST_API_URL`: Upstash Redis REST URL.
- `UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_TOKEN`: Upstash Redis REST token.

Optional:

- `MAX_MESSAGE_CHARS`: default `32`.
- `SENDER_RATE_LIMIT_COUNT`: default `10`.
- `SENDER_RATE_LIMIT_WINDOW_SECONDS`: default `60`.
- `TRANSIENT_QUEUE_LIMIT`: default `5`.
- `DEFAULT_TRANSIENT_TTL_SECONDS`: default `300`.
- `DEFAULT_DISPLAY_SECONDS`: default `20`.
- `MIN_TTL_SECONDS`: default `1`.
- `MAX_TTL_SECONDS`: default `86400`.
- `MIN_DISPLAY_SECONDS`: default `1`.
- `MAX_DISPLAY_SECONDS`: default `300`.
- `RECEIVER_STATUS_TTL_SECONDS`: default `30`; used by display status to decide whether the receiver is recently online.
- `REDIS_KEY_PREFIX`: default `k20gt:remote-message`.

## Local HTTP Checks

Run the API locally with Vercel:

```powershell
npx vercel dev
```

Create a sticky:

```powershell
curl.exe -X POST "http://localhost:3000/api/messages" `
  -H "Authorization: Bearer $env:SEND_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"type\":\"sticky\",\"text\":\"今天别熬夜\"}"
```

Create a transient:

```powershell
curl.exe -X POST "http://localhost:3000/api/messages" `
  -H "Authorization: Bearer $env:SEND_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"type\":\"transient\",\"text\":\"喝水\",\"ttlSeconds\":300,\"displaySeconds\":20}"
```

Pull the next message:

```powershell
curl.exe "http://localhost:3000/api/messages/next" `
  -H "Authorization: Bearer $env:RECEIVER_TOKEN"
```

Ack a message:

```powershell
curl.exe -X POST "http://localhost:3000/api/messages/<message-id>/ack" `
  -H "Authorization: Bearer $env:RECEIVER_TOKEN"
```

Dismiss/read a message from the receiver side:

```powershell
curl.exe -X POST "http://localhost:3000/api/messages/<message-id>/dismiss" `
  -H "Authorization: Bearer $env:RECEIVER_TOKEN"
```

Clear the current sticky:

```powershell
curl.exe -X POST "http://localhost:3000/api/messages/clear" `
  -H "Authorization: Bearer $env:SEND_TOKEN"
```

Read display status for the web sender:

```powershell
curl.exe "http://localhost:3000/api/display/status" `
  -H "Authorization: Bearer $env:SEND_TOKEN"
```

Update receiver status from the local receiver:

```powershell
curl.exe -X POST "http://localhost:3000/api/display/status" `
  -H "Authorization: Bearer $env:RECEIVER_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"dnd\":false,\"lastStatus\":\"ok\",\"remoteDisplayActive\":false}"
```

## Dismiss Semantics

`dismiss` is receiver-only. `SEND_TOKEN` cannot call it, because senders should not be able to forge local read/display state.

- Dismissing a current `sticky` marks it `expired`, removes it from current sticky, and prevents `/next` from returning it again.
- Dismissing a pending or showing `transient` marks it `shown` and removes it from transient scheduling.
- Unknown, expired, or shown messages return safely without changing unrelated state.
- `ack` remains unchanged: it records that the receiver displayed a message. `dismiss` records that the local receiver/user is done with the current inserted message.

## Public Display State

Public message responses keep the internal `status` field and now also include:

- `displayState`: user-facing state such as `active`, `showing`, `shown`, `dismissed`, `expired`, `replaced`, or `cleared`.
- `endedReason`: terminal reason such as `shown`, `dismissed`, `cleared`, `replaced`, `ttl_expired`, or `showing_timeout`.
- `endedAt`: timestamp when the terminal reason was recorded.

`GET /api/display/status` requires `SEND_TOKEN` and returns receiver status, current sticky summary, pending transient count, pending transient summaries, and the current receiver-reported display message when known. `POST /api/display/status` requires `RECEIVER_TOKEN`; the sender token cannot update receiver DND/status.
