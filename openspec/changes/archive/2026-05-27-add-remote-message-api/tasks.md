## 1. Project and Configuration Setup

- [x] 1.1 Inspect the current repository structure and choose the smallest Vercel-compatible API structure for this workspace.
- [x] 1.2 Add required API/runtime dependencies, preferring a minimal Next.js route handler setup and an Upstash Redis client if no existing app structure is present.
- [x] 1.3 Add environment configuration handling for `SEND_TOKEN`, `RECEIVER_TOKEN`, Redis connection settings, message length, rate limits, queue limit, default TTL, and display duration.
- [x] 1.4 Document required environment variables and local HTTP test commands without adding sender UI or receiver code.

## 2. Message Model and Storage

- [x] 2.1 Define message types, statuses, validation schemas, and timestamp fields for sticky and transient records.
- [x] 2.2 Implement a small Redis-backed storage module for message records, current sticky pointer, pending transient FIFO index, and rate-limit counters.
- [x] 2.3 Implement expiry cleanup for pending messages, current sticky, and showing transient timeouts.
- [x] 2.4 Ensure storage operations avoid returning replaced, shown, expired, or timed-out messages from scheduling paths.

## 3. API Endpoints

- [x] 3.1 Implement `POST /api/messages` with `SEND_TOKEN`, payload validation, sender rate limiting, sticky replacement, and transient queue-limit enforcement.
- [x] 3.2 Implement `GET /api/messages/next` with `RECEIVER_TOKEN`, cleanup-first scheduling, transient FIFO priority, sticky fallback, and `null` when empty.
- [x] 3.3 Implement `POST /api/messages/{id}/ack` with `RECEIVER_TOKEN`, transient-to-`shown` behavior, sticky display metadata updates, and safe handling for unknown or expired IDs.
- [x] 3.4 Implement `POST /api/messages/clear` with authorized token handling and current sticky clearing.
- [x] 3.5 Keep all route responses simple and receiver-friendly, including stable message IDs, type, text, displaySeconds, status, and timestamps needed for later receiver work.

## 4. Tests and Verification

- [x] 4.1 Add API/storage tests for creating sticky, replacing sticky, clearing sticky, and sticky ack remaining active.
- [x] 4.2 Add API/storage tests for creating transient, FIFO scheduling, ack-to-shown behavior, no repeat before ack, queue-limit rejection, and expiration.
- [x] 4.3 Add authentication and rate-limit tests for sender and receiver endpoints.
- [x] 4.4 Add local manual verification notes or scripts using HTTP requests against the API routes.

## 5. Documentation and Closeout

- [x] 5.1 Update `AGENTS.md` to reflect that `add-remote-message-api` has been created or implemented, preserving the fact that receiver, UI, HID writes, and long-text experiments remain separate changes.
- [x] 5.2 Confirm no files under the official `MCHOSE HUB` installation directory were modified.
- [x] 5.3 Run OpenSpec validation/status for `add-remote-message-api` and address any artifact or spec formatting issues.
