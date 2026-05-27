# Local Message Receiver

This receiver is the first local bridge from the remote message API to the connected `MCHOSE K20 GT` screen.

It polls the cloud API, writes returned message text with the known local HID screen writer, and calls ack only after the local write succeeds. When the API returns `message: null`, it does not change the screen.

## Requirements

- Node.js 18 or newer, because the receiver uses native `fetch`.
- A connected `MCHOSE K20 GT` screen endpoint that works with `npm run screen`.
- A deployed or local remote message API from `add-remote-message-api`.

## Environment Variables

Required:

- `REMOTE_MESSAGE_API_BASE_URL`: API origin, for example `https://your-app.vercel.app` or `http://localhost:3000`.
- `RECEIVER_TOKEN`: bearer token accepted by `GET /api/messages/next` and `POST /api/messages/{id}/ack`.

Optional:

- `RECEIVER_POLL_INTERVAL_MS`: poll interval in milliseconds, default `3000`.
- `RECEIVER_LOG_LEVEL`: `info` by default; use `debug` to log empty polls.

## Run

```powershell
$env:REMOTE_MESSAGE_API_BASE_URL = "http://localhost:3000"
$env:RECEIVER_TOKEN = "receiver-secret"
npm run receiver
```

Stop it with Ctrl+C. The receiver stops scheduling new polls and exits cleanly.

## Behavior

- `sticky` and `transient` scheduling stays on the server. The receiver writes whatever `/api/messages/next` returns.
- `displaySeconds` is logged/available for future behavior but does not block the local loop in this version.
- Screen write failure skips ack and keeps the receiver running.
- API, ack, and JSON failures are logged and do not crash the loop.
- Pause/do-not-disturb, tray app packaging, Windows service/autostart, sender UI, bot integrations, multi-device support, and long-text display strategy remain future changes.
