## Context

The current workspace can write local text to the `MCHOSE K20 GT` screen through `node-hid`, but it does not yet have a cloud relay. The agreed first remote validation direction is Vercel plus lightweight Redis/KV storage, with a future local receiver actively polling the cloud so her computer does not expose a public port.

The previous `probe-long-text-display` change is only partially complete because device observation is not convenient right now. This change therefore uses a conservative, configurable text policy and does not decide final long-text rendering behavior.

## Goals / Non-Goals

**Goals:**

- Provide a deployable HTTP API for remote message creation, scheduling, acknowledgement, and sticky clearing.
- Model messages as `sticky` and `transient` with simple states: `pending`, `showing`, `shown`, and `expired`.
- Keep at most one current sticky and a small bounded transient queue.
- Use separate sender and receiver tokens from environment variables.
- Use Redis/KV storage with TTL-aware cleanup and simple rate limiting.
- Keep the API suitable for a future Node receiver polling about every 3 seconds.

**Non-Goals:**

- No local receiver process, polling loop, screen write, HID command, or `k20gt-screen.js` integration.
- No web sender UI, Telegram, WeChat, registration, login, multi-user, or multi-device support.
- No tray app, Windows service, installer, pause/do-not-disturb UX, or autostart packaging.
- No resolution of long-text display, scrolling, lyric layer, custom text layer, or image upload protocol questions.
- No modification of the official `MCHOSE HUB` installation directory.

## Decisions

1. Use route handlers/API routes with a small storage abstraction.

   The implementation should choose the simplest Vercel-compatible API structure that fits the repository at implementation time. If a Next.js app is introduced, route handlers are preferred. Storage operations should sit behind a small module so the API code does not directly scatter Redis key details.

   Alternative considered: implement an Express server. That would add deployment friction for Vercel and does not match the intended first hosted validation path.

2. Use Upstash Redis-style primitives for the first cloud store.

   The API needs a short FIFO transient queue, a current sticky pointer, message hashes/JSON, TTL metadata, and counters for rate limiting. Redis provides these with low ceremony on Vercel, and Upstash is the preferred marketplace option for this validation phase.

   Alternative considered: in-memory storage. That would make local demos easy but would not survive serverless invocations and would give a false sense of scheduling correctness.

3. Store messages as explicit records and keep scheduling indexes small.

   A message record should include `id`, `type`, `text`, `status`, `createdAt`, `updatedAt`, `expiresAt`, `displaySeconds`, `showingDeadlineAt`, `shownAt`, and `lastDisplayedAt` where applicable. Transient scheduling should use a FIFO pending index, while the current sticky should be a single pointer. Expired or completed messages can remain briefly for ack/debug history but must not be returned by `next`.

   Alternative considered: only store queue items without durable records. That makes ack and status transitions harder to test and weakens future delivery/debug behavior.

4. Make `next` responsible for cleanup and scheduling.

   `GET /api/messages/next` should first expire stale pending/showing messages, including showing transients whose display/ack window elapsed. It should then return the oldest pending transient and mark it `showing`; otherwise it should return the current valid sticky and mark it `showing` if needed; otherwise it returns `null`.

   Alternative considered: background cleanup jobs. They add operational complexity and are unnecessary for the small polling API.

5. Keep sticky persistent and replaceable.

   Creating a new sticky should expire or supersede the previous current sticky and set the new sticky as the current target. A sticky can have no `expiresAt`. Acking sticky updates display metadata but does not move it to `shown`, because sticky is a continuing desired state.

   Alternative considered: treat sticky as a normal queue item. That would make the receiver lose the persistent target after one ack, which conflicts with the product model.

6. Keep transient delivery intentionally non-reliable after timeout.

   A transient should be returned once while it is pending, move to `showing`, and become `shown` only after ack. If it expires before display or times out while showing, it becomes `expired` and is not replayed. This avoids old reminders piling up after receiver downtime.

   Alternative considered: retry showing transients until ack. That would improve reliability but risks stale notifications and surprise repeats on a tiny always-visible screen.

7. Use bearer tokens and simple environment configuration.

   `POST /api/messages` must require `SEND_TOKEN`; `GET /api/messages/next` and `POST /api/messages/:id/ack` must require `RECEIVER_TOKEN`; `POST /api/messages/clear` may accept either token so both the sender side and receiver side can clear sticky state. Missing token configuration should fail closed.

   Alternative considered: one shared token. Separate tokens reduce damage if a sender token leaks, because it cannot forge receiver acknowledgements.

8. Keep text validation conservative but configurable.

   The default `MAX_MESSAGE_CHARS` should be 32 characters as a safe first fallback, with a configuration path to change it after `probe-long-text-display` updates the device facts. The API should also guard empty text and unreasonable TTL/display values.

   Alternative considered: enforce the lower-level byte limit now. That may be more accurate later, but visible device behavior is not settled yet.

## Risks / Trade-offs

- Vercel plus Upstash may be slow or unstable from the receiver's network -> keep the store abstraction and document that the region/provider can move later.
- Redis serverless operations can race under concurrent sender/receiver calls -> use atomic Redis operations or short critical sections where queue size, creation, and next selection must be consistent.
- A transient may be marked showing and then lost if the receiver crashes before ack -> accept this for v1 to avoid stale repeat notifications.
- Configurable text length can diverge from actual device capability -> default conservatively and leave long-text behavior to the probing change.
- Rate limiting with a single token can block legitimate bursts -> choose small, understandable defaults and keep them configurable.

## Migration Plan

1. Add the Vercel-compatible API project structure and dependencies.
2. Add environment variable documentation for `SEND_TOKEN`, `RECEIVER_TOKEN`, Redis connection settings, and optional limits.
3. Deploy to Vercel with Upstash Redis configured.
4. Verify with HTTP requests before connecting any local receiver.
5. Roll back by disabling the Vercel deployment or rotating tokens; no device-side state is changed by this API alone.

## Open Questions

- Exact Redis key names and atomicity approach should be finalized during implementation.
- The final hosting region and long-term cloud provider may change after receiver network tests.
- Text length defaults may change after the remaining `probe-long-text-display` experiments.
