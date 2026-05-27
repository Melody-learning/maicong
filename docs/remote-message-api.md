# Remote Message API

This document describes the cloud relay API. The first local receiver is documented separately in `docs/local-message-receiver.md`, and the minimal browser sender is documented in `docs/web-message-sender.md`.

## Environment Variables

Required:

- `SEND_TOKEN`: bearer token for `POST /api/messages`.
- `RECEIVER_TOKEN`: bearer token for `GET /api/messages/next` and `POST /api/messages/{id}/ack`.
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

Clear the current sticky:

```powershell
curl.exe -X POST "http://localhost:3000/api/messages/clear" `
  -H "Authorization: Bearer $env:SEND_TOKEN"
```
