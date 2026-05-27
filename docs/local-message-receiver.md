# Local Message Receiver

This receiver is the first local bridge from the remote message API to the connected `MCHOSE K20 GT` screen.

It polls the cloud API, writes returned message text with the known local HID screen writer, and calls ack only after the local write succeeds. When a previously active remote display target ends and the API returns `message: null`, the receiver can now release the remote custom-text occupation and restore a configured baseline/lyric switch.

## Requirements

- Node.js 18 or newer, because the receiver uses native `fetch`.
- A connected `MCHOSE K20 GT` screen endpoint that works with `npm run screen`.
- A deployed or local remote message API from `add-remote-message-api`.

## Environment Variables

Required:

- `REMOTE_MESSAGE_API_BASE_URL`: API origin, for example `https://your-app.vercel.app` or `http://localhost:3000`.
- `RECEIVER_TOKEN`: bearer token accepted by `GET /api/messages/next`, `POST /api/messages/{id}/ack`, and `POST /api/messages/{id}/dismiss`.

Optional:

- `RECEIVER_POLL_INTERVAL_MS`: poll interval in milliseconds, default `3000`.
- `RECEIVER_LOG_LEVEL`: `info` by default; use `debug` to log empty polls.
- `RECEIVER_RESTORE_ON_EMPTY`: restore display when `/next` returns no message after remote display was active, default `true`.
- `RECEIVER_RESTORE_LYRIC`: re-enable lyric display during restore, default `true`.
- `RECEIVER_RESTORE_SCREEN_STATE`: comma-separated `cmd 9` payload used as the fallback baseline, default `1,112,241,142,0,0,2`. Set to an empty value to skip the `cmd 9` restore.
- `RECEIVER_TRANSIENT_RESTORE_DELAY_MS`: optional local delay before restore on empty, default `0`. The receiver still relies on server scheduling for normal `displaySeconds` behavior.
- `RECEIVER_DND`: start with Do Not Disturb enabled, default `false`.
- `RECEIVER_CONTROL_FILE`: local one-shot JSON control file path, default `receiver-control.json`.
- `RECEIVER_STATUS_TTL_SECONDS`: cloud receiver-status TTL, default `30`.
- `RECEIVER_STATUS_UPDATE_INTERVAL_MS`: reserved optional status throttling value, default `0`; current receiver may report every loop.

## Run

```powershell
$env:REMOTE_MESSAGE_API_BASE_URL = "http://localhost:3000"
$env:RECEIVER_TOKEN = "receiver-secret"
npm run receiver
```

Stop it with Ctrl+C. The receiver stops scheduling new polls and exits cleanly.

## Local Controls

The first control surface is a local JSON file. The receiver checks it once per poll tick before requesting `/api/messages/next`. After a valid command succeeds, the receiver deletes the file so the command is not repeated.

Dismiss/read the current remote message:

```powershell
Set-Content -Path receiver-control.json -Encoding utf8 -Value '{"command":"dismiss"}'
```

Enable Do Not Disturb:

```powershell
Set-Content -Path receiver-control.json -Encoding utf8 -Value '{"command":"dnd","enabled":true}'
```

Disable Do Not Disturb:

```powershell
Set-Content -Path receiver-control.json -Encoding utf8 -Value '{"command":"dnd","enabled":false}'
```

Short form is also accepted:

```json
{ "dnd": true }
```

## Behavior

- `sticky` and `transient` scheduling stays on the server. The receiver writes whatever `/api/messages/next` returns.
- A `sticky` remains a remote display target until it is replaced, cleared, dismissed/read, or expired. Dismissing current sticky calls the server dismiss endpoint, then restores the configured baseline/lyric switch.
- After a `transient` is acked, the next server result decides what happens: if `/next` returns sticky, the receiver writes that sticky; if `/next` returns `null`, it restores the configured baseline/lyric switch.
- When sticky is cleared, `/next` returns `null`; if the receiver had remote display active, it restores once and does not repeat restore on every empty poll.
- DND is receiver-local and authoritative. The receiver reports it to cloud display status for the web page, but the web page does not remotely toggle it. While DND is on, the receiver skips `/next`, does not write the screen, and does not ack undisplayed messages. Transients rely on TTL to expire; sticky stays current server-side unless dismissed or cleared.
- Enabling DND while a remote message is active attempts restore immediately so the remote text does not keep occupying the screen.
- DND is not dismiss: DND controls whether future remote display may enter; dismiss handles the current inserted message.
- Restore writes the configured screen-state payload first, then re-enables lyric display when `RECEIVER_RESTORE_LYRIC=true`.
- Lyric restore only restores the lyric switch. It does not save, replay, or promise to preserve lyric text; when music has lyrics, the device/official path is expected to continue supplying lyrics.
- The default fallback screen-state payload `1,112,241,142,0,0,2` is the observed official preset baseline from the 2026-05-28 restore probe. It does not restore an arbitrary previous official custom text.
- `displaySeconds` is still owned by the server state machine and does not locally block the receiver loop in this version.
- Screen write failure skips ack and keeps the receiver running.
- API, ack, and JSON failures are logged and do not crash the loop.
- Receiver status update failures are logged and do not crash the loop.
- Restore failure is logged and does not crash the loop.
- Automatic MCHOSE HUB local-takeover detection is not implemented in this version. Use the local dismiss command to mark the current remote message read/closed. A future tray app or conservative HID readback detector can call the same dismiss helper.
- Tray app packaging, Windows service/autostart, bot integrations, multi-device support, and long-text display strategy remain future changes. The first minimal browser sender is documented separately in `docs/web-message-sender.md`.

## Manual Restore Check

Suggested physical-device check:

1. Start `npm run receiver`.
2. Send a `transient` with no active sticky and observe that the screen restores to the configured preset/lyrics after the transient is acked and `/next` becomes empty.
3. Send a `sticky` and confirm it keeps displaying.
4. Clear sticky and observe that the next empty poll restores to the configured preset/lyrics.
5. Send sticky plus transient and confirm the transient is followed by sticky, not by baseline restore.
6. While sticky is visible, write `{"command":"dismiss"}` to `receiver-control.json` and confirm the sticky is dismissed server-side and the display restores.
7. Write `{"command":"dnd","enabled":true}` and confirm later polls do not write or ack remote messages until DND is disabled.
