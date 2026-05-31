# Local Message Receiver

The local receiver is the Windows-side adapter between the cloud board API and the MCHOSE K20 GT HID screen writer.

It polls `GET /api/board`, writes a new board id to the screen, reports `POST /api/board/{id}/displayed` only after a successful screen write, and restores the configured baseline when the current board becomes empty or expired.

## Configuration

Daily use should prefer `receiver.config.json`:

```json
{
  "apiBaseUrl": "https://your-vercel-project.vercel.app",
  "receiverToken": "replace-with-random-receiver-token",
  "sendToken": "replace-with-random-sender-token",
  "pollIntervalMs": 3000,
  "textLimit": 32,
  "restoreOnEmpty": true,
  "restoreLyric": true,
  "restoreScreenState": [1, 112, 241, 142, 0, 0, 2],
  "transientRestoreDelayMs": 0,
  "dnd": false,
  "controlFile": "receiver-control.json",
  "logLevel": "info"
}
```

`transientRestoreDelayMs` is kept as a local restore-delay setting for runtime compatibility, even though the cloud API no longer has transient messages.

For local development, `npm run receiver` also reads `.env.local` and `.env` automatically, with project `.env` values taking precedence so the receiver matches the local `npm run vercel:dev` API configuration. This lets the receiver reuse the same `RECEIVER_TOKEN`, `SEND_TOKEN`, and tuning values without manually exporting variables in each PowerShell session. Values in `receiver.config.json` still override `.env` files for the current machine, and real process environment variables override both. If an env file provides a receiver token but no API base URL, the receiver defaults to `http://localhost:3000` for the local Vercel dev server.

Treat `receiver.config.json` as the current machine's runtime config. It is useful for day-to-day local receiver runs, but it is no longer the default source for production private bundle generation.

For safe local testing, keep a separate dev token pair in ignored `.env.local` and point it at the local dev server:

```text
REMOTE_MESSAGE_API_BASE_URL=http://localhost:3000
SEND_TOKEN=<dev sender token>
RECEIVER_TOKEN=<dev receiver token>
REDIS_KEY_PREFIX=k20gt:remote-board-dev
```

This lets local Vercel dev and the local receiver test against a dev board namespace instead of the production sender/receiver token pair and production board keys.

Important fields:

- `apiBaseUrl`: deployed API base URL.
- `receiverToken`: receiver-only token for board polling/displayed/dismiss/status updates.
- `sendToken`: optional sender token for `receiver:status`.
- `restoreScreenState`: fallback `cmd 9` payload, default `[1,112,241,142,0,0,2]`; use `[]` to skip `cmd 9` restore.
- `dnd`: starts receiver-local Do Not Disturb when true.
- `controlFile`: one-shot local control file consumed by the receiver loop.

## Commands

```powershell
npm run receiver
npm run receiver:install
npm run receiver:start
npm run receiver:runtime:status
npm run receiver:stop
npm run receiver:autostart:on
npm run receiver:autostart:off
npm run receiver:status
npm run receiver:dnd:on
npm run receiver:dnd:off
npm run receiver:dismiss
npm run receiver:restore
npm run receiver:bundle
```

- `receiver` runs the foreground polling loop.
- `receiver:status` reads cloud display status with `SEND_TOKEN` and prints receiver/DND/current board summary.
- `receiver:dismiss` asks the running receiver to dismiss the current board by id and restore the local display.
- `receiver:restore` restores the local display without dismissing the server-side board.
- `receiver:dnd:on` turns on receiver-local DND. While DND is on, the receiver does not fetch, write, or report undisplayed boards.
- `receiver:dnd:off` resumes board polling on later loop ticks.

## Runtime Behavior

- No current board and no active remote occupation: do nothing.
- No current board after active remote occupation: run configured restore once.
- New board id: write board text to the K20 GT screen, then report displayed.
- Same active board id: do not rewrite the screen and do not report displayed again.
- Screen write failure: do not report displayed and do not restore for that failed write.
- Displayed-report failure: keep the local session active for the written board and continue polling.
- DND is local authority. It does not clear the server board; it only blocks future local display writes while enabled.

The shared HID writer and probe files are unchanged by the board-model simplification.

## Private Receiver Bundle

Use `npm run receiver:bundle` to generate a git-ignored private Windows bundle in `dist/k20gt-receiver-windows/`. The bundle includes `receiver.config.json`, wrapper `.cmd` files, and a README. The generated folder and zip can contain real tokens and must not be committed or uploaded publicly.

The default bundle command is production-oriented. It reads config from explicit CLI arguments, then `BUNDLE_API_BASE_URL` / `BUNDLE_RECEIVER_TOKEN` / `BUNDLE_SEND_TOKEN`, then `REMOTE_MESSAGE_API_BASE_URL` / `RECEIVER_TOKEN` / `SEND_TOKEN` loaded from the process environment and local `.env`. It does not copy the root `receiver.config.json` and does not load `.env.local` unless you explicitly ask for local test behavior.

This prevents a current-machine development config such as `http://localhost:3000` from being packaged for another Windows machine. The command rejects localhost or loopback API URLs by default; pass `--allow-localhost` only when intentionally generating a local test bundle.

After receiver/runtime-impacting code changes, regenerate the bundle and zip:

```powershell
npm run receiver:bundle
Compress-Archive -Path dist/k20gt-receiver-windows\* -DestinationPath dist/k20gt-receiver-windows.zip -Force
```

To intentionally copy a prepared config file instead of using env values:

```powershell
node scripts/prepare-receiver-bundle.js --config-source receiver.production.config.json
```

To intentionally generate a local test bundle from `.env.local`:

```powershell
node scripts/prepare-receiver-bundle.js --include-local-env --allow-localhost
```

## Verification Note

The `simplify-remote-display-to-expiring-board` change was verified with unit/API/receiver/web behavior tests using mocked screen writes and restores. It was not verified on a live K20 GT HID display.
