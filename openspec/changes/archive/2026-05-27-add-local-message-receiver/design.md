## Context

The repository already has two pieces needed for end-to-end remote delivery: `k20gt-screen.js` can write short text to the connected K20 GT screen, and `add-remote-message-api` implemented the cloud scheduling API. The missing piece is a local process on her computer that polls the cloud, writes returned messages to the device, and acknowledges only after a successful local write.

Device probing is still incomplete. The receiver must therefore stay conservative: it sends the message text through the current known-good custom-text path and leaves long text, lyric-layer behavior, image upload, pause/do-not-disturb UX, tray packaging, and autostart for later changes.

## Goals / Non-Goals

**Goals:**

- Provide a local Node.js receiver that can run from `npm run receiver`.
- Read `REMOTE_MESSAGE_API_BASE_URL`, `RECEIVER_TOKEN`, and `RECEIVER_POLL_INTERVAL_MS` from environment variables.
- Poll `GET /api/messages/next`, write returned messages to the K20 GT screen, and ack with `POST /api/messages/{id}/ack` only after write success.
- Keep no-message and error paths non-invasive and resilient.
- Preserve the existing `npm run screen -- "文本"` CLI behavior.
- Make receiver behavior testable without HID hardware or a live API.

**Non-Goals:**

- No local scheduling of transient display duration or delayed sticky restoration.
- No tray app, Windows service, autostart, installer, pause/do-not-disturb, sender UI, Telegram, WeChat, registration, multi-user, or multi-device support.
- No changes to the remote message API contract.
- No changes to official `MCHOSE HUB` files.
- No new long-text, lyric-layer, or image protocol experiments.

## Decisions

1. Split receiver logic into a reusable module plus a thin CLI.

   The module should expose config parsing, a single polling iteration, and a loop runner. The CLI script should wire these to environment variables, the shared screen writer, `fetch`, timers, and signal handling. This keeps tests deterministic and avoids needing real HID hardware.

   Alternative considered: put all logic directly in `k20gt-receiver.js`. That is simpler initially but makes the acceptance criteria harder to test cleanly.

2. Use Node 18+ native `fetch` and no new HTTP dependency.

   The current project is a small Node/Vercel workspace. Native `fetch` is enough for `GET next` and `POST ack`, and avoiding a dependency keeps the receiver easy to run.

   Alternative considered: add `node-fetch` or Axios. That adds package churn for no needed capability in v1.

3. Ack strictly after local write success.

   A message should be acknowledged only when the write function completes without throwing. If HID access fails, the receiver logs the error and leaves the message unacked so the server-side state machine remains the source of truth.

   Alternative considered: ack before writing to avoid repeats. That can lose messages whenever the device is disconnected or HID writing fails.

4. Let the server drive sticky/transient scheduling.

   The receiver should not sleep for `displaySeconds` or maintain its own sticky restore state. After a transient is acked, the next poll naturally lets the API return the current sticky if one exists.

   Alternative considered: block locally for transient display duration and then immediately restore sticky. That couples local timing to API state and makes failure recovery more complex before the product needs it.

5. Treat no-message and failure paths as non-fatal.

   A `null` message response should not touch the screen. Network failures, non-2xx responses, invalid JSON, write failures, and ack failures should be logged but should not crash the receiver loop.

   Alternative considered: exit on repeated errors. That is appropriate for a packaged supervisor later, but not for the first script-based validation.

## Risks / Trade-offs

- API or network instability can produce repeated logs and delayed delivery -> keep polling interval configurable and errors non-fatal.
- Ack failure after successful write can cause server-side state to remain `showing` until timeout -> log clearly; reliable retry semantics can be considered later.
- The current screen writer may truncate UTF-8 payloads to the HID limit -> accept for v1 and keep long-text behavior in `probe-long-text-display`.
- The receiver has no pause/do-not-disturb control -> document this as a follow-up change and keep Ctrl+C graceful.
- Native `fetch` requires Node 18+ -> document the runtime expectation.

## Migration Plan

1. Refactor the existing screen writer into `lib/k20gt-screen-writer.js` and keep `k20gt-screen.js` as the CLI entry point.
2. Add receiver module, CLI script, and npm script.
3. Add unit tests with injected fetch/write/log/timer behavior.
4. Document receiver environment variables and manual checks.
5. Roll back by stopping the receiver process; no cloud data migration or official client file changes are involved.

## Open Questions

- Whether Vercel + Upstash latency is acceptable from the real receiver network remains to be measured after deployment.
- Pause/do-not-disturb, tray packaging, autostart, and richer failure/backoff behavior need later product changes.
