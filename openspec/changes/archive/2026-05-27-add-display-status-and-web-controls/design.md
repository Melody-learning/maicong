## Overview

The display status model is a product-layer summary over the existing message scheduler and the local receiver session. It does not try to mirror every K20 GT native display layer. The first version answers three sender-facing questions:

- Is the receiver recently online?
- Is receiver-local DND enabled?
- What remote message target is active, pending, or ended?

## Decisions

### Receiver-Local DND Is Authoritative

This change uses the conservative DND sync model:

- The receiver reads local config/control-file DND.
- The receiver reports DND to the cloud.
- The web sender shows DND as read-only.

The sender token can already create and clear remote sticky text, but it should not yet remotely change the receiver user's local interruption boundary.

### Public Message State

Internal message `status` remains compatible: `pending`, `showing`, `shown`, `expired`.

Public responses add:

- `displayState`: `active`, `showing`, `dismissed`, `expired`, `replaced`, `cleared`, or `shown`.
- `endedReason`: `ttl_expired`, `dismissed`, `cleared`, `replaced`, `shown`, or `showing_timeout`.
- `endedAt`: ISO timestamp when a terminal/end reason was assigned.

Mapping rules:

- Active `pending` messages return `displayState=active`.
- Active `showing` messages return `displayState=showing`.
- `status=shown` with `endedReason=dismissed` returns `displayState=dismissed`.
- `status=shown` with `endedReason=shown` returns `displayState=shown`.
- `status=expired` maps by reason: `replaced`, `cleared`, `dismissed`, or `expired`.

### Receiver Status Storage

Store a single receiver status record at `<prefix>:receiverStatus` with Redis TTL:

- `dnd`
- `lastSeenAt`
- `lastStatus`
- `lastDisplayMessageId`
- `lastDisplayMessageType`
- `remoteDisplayActive`

TTL defaults to 30 seconds. `GET /api/display/status` derives `receiver.online` by comparing `lastSeenAt` and the TTL window.

### API Routes

`GET /api/display/status`

- Requires `SEND_TOKEN`.
- Returns receiver summary, current sticky summary, pending transient count, oldest pending transient summaries, and current remote display summary if known.

`POST /api/display/status`

- Requires `RECEIVER_TOKEN`.
- Accepts receiver status updates.
- Does not schedule messages, ack messages, or mutate message state.

This keeps status sync separate from `/api/messages/next`.

## Failure Handling

- Receiver status update failure is logged and does not stop the receiver loop.
- Missing receiver status is returned as `online=false`, `dnd=false`, and `status=null`.
- Display status reads call storage cleanup first so TTL and showing-timeout reasons are reflected before the web reads state.

## Compatibility

Existing receiver versions can continue to call `/api/messages/next`, `/ack`, `/dismiss`, and `/clear` without sending status. Existing public message fields are preserved.
