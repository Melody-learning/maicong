## Why

The project needs a remote delivery path before the local receiver and sender UI can be validated end to end. Because device-side long-text and display-layer probing is still ongoing, this change focuses on the cloud message model, state machine, scheduling, and security boundary without touching HID writes.

## What Changes

- Add a Vercel-deployable HTTP API for remote screen messages.
- Store messages and scheduling state in a lightweight Redis/KV backend, with Upstash Redis as the preferred first implementation.
- Support two message types: `sticky` for the current persistent target text and `transient` for short FIFO display tasks.
- Add token authentication with separate `SEND_TOKEN` and `RECEIVER_TOKEN` environment variables.
- Add validation for message type, text length, TTL, display duration, rate limits, and transient queue size.
- Add API routes for creating messages, pulling the next message, acknowledging display, and clearing the current sticky.
- Keep text limits configurable and default to a conservative 32-character cap until later display probing updates the device strategy.
- Explicitly exclude the local receiver, web sender UI, HID screen writing, tray app, bot integrations, and long-text display experiments.

## Capabilities

### New Capabilities

- `remote-message-api`: Defines remote screen-message creation, token-protected scheduling, Redis-backed state, sticky/transient behavior, acknowledgement, expiry, rate limiting, and clear operations.

### Modified Capabilities

- None.

## Impact

- Affected code: new Vercel/Next.js API route structure, message storage module, validation/config module, and API tests.
- Affected dependencies: likely Next.js runtime plus an Upstash Redis client, chosen during implementation with minimal repository churn.
- Affected systems: cloud message relay only; no direct `MCHOSE K20 GT` HID access is included.
- Follow-on changes: `add-local-message-receiver` can poll `GET /api/messages/next` and ack returned messages; `add-web-message-sender` can call `POST /api/messages`.
