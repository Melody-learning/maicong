## Context

The small-blackboard model now stores one current expiring board at a time, while individual board records already contain useful lifecycle fields such as `createdAt`, `expiresAt`, `displayedAt`, `endedAt`, and `endedReason`. The missing piece for a web history view is an ordered index of recent board ids; without that index, listing recent boards would require unsafe or inefficient Redis key scanning.

The product requirement is intentionally lightweight: the sender page should show recent board write time and content, with a simple marker for the current board. It should not expose receiver diagnostics, ended reasons, display acknowledgement status, or queue-like behavior.

## Goals / Non-Goals

**Goals:**
- Add a bounded recent-board history index for newly created boards.
- Expose a sender-token history endpoint that returns recent boards in newest-first order.
- Include an `isCurrent` marker for the current active board in history responses.
- Render a simple web history list containing only time, text, and the current marker.
- Refresh history after page load/status refresh, board creation, and board clearing.

**Non-Goals:**
- No notification inbox, queue, retry list, multi-user history, search, pagination, or analytics.
- No web display of `endedReason`, `displayedAt`, receiver dismiss state, or low-level lifecycle labels.
- No receiver behavior changes and no HID/protocol changes.
- No migration of old sticky/transient data or pre-history board records into history.
- No first-version remote history deletion UI unless later privacy feedback requires it.

## Decisions

### 1. Store a bounded board-history index

On successful board creation, add the new board id to a Redis history index such as `boardHistory` with the creation timestamp as the ordering score. Trim the index to a configurable or fixed recent count, with `20` as the first-version default.

Rationale: a small sorted set/list gives stable newest-first listing without scanning `board:*` keys. Keeping only recent ids matches the lightweight UI and limits retention of private text.

Alternative considered: scan all `board:*` keys and sort by `createdAt`. This is simpler to imagine but unsuitable for Upstash/serverless usage and would grow worse over time.

### 2. Treat history as recent writes, not lifecycle events

The history endpoint should return board summaries ordered by `createdAt`, not a separate event stream. Replaced, expired, cleared, and dismissed boards remain visible as recent written content, but those lifecycle reasons are not part of the first-version web presentation.

Rationale: the user asked for time plus content only. A lifecycle event log would be more powerful for debugging, but it would make the sender page feel like an operations console.

Alternative considered: store every event such as created/displayed/expired/cleared. This can be added later if needed, but it is unnecessary for confirming recent board content.

### 3. Compute the current marker server-side

`GET /api/board/history` should clean up expired current state using the same board cleanup rules as current-board reads, then compare each listed board id to the current unexpired board id. Returned summaries should include `isCurrent: true` only for that board.

Rationale: the web page should not infer current state by comparing separate responses that might be out of sync. Server-side marking also keeps the UI simple.

Alternative considered: let the web page call `/api/display/status` and mark the matching id locally. That avoids a new response field but couples history rendering to status response shape.

### 4. Use sender-token authorization

History reads should require the `SEND_TOKEN`. They should not accept unauthenticated requests and do not need the `RECEIVER_TOKEN` for first-version web usage.

Rationale: history contains private message text. The web sender already uses the send token for reading display status, sending boards, and clearing the current board.

Alternative considered: allow receiver-token history reads. There is no receiver use case for history in this change, so broadening access is unnecessary.

## Risks / Trade-offs

- Existing board records will not appear in history if they were created before the index exists -> Accept this as a forward-only feature and document that history begins after deployment.
- History stores recent private text longer than the active board duration -> Keep retention bounded to a small count and avoid adding search or permanent archive behavior.
- `isCurrent` can mean "current board target" even if receiver DND prevents physical display -> Use the neutral label `当前` in the UI, not `显示中`.
- Trimmed history ids may point to records that were manually deleted or expired by future retention policy -> Skip missing records safely when listing history.

## Migration Plan

1. Deploy storage/API changes before or with the web UI so new board writes start populating history.
2. Existing active boards may be absent from history until the next board creation; current status remains available through existing status APIs.
3. Rollback by removing the web history UI and endpoint use; the extra history index can remain harmlessly unused or be manually deleted from Redis if desired.

## Open Questions

- Should the retention count be fixed at `20` or configurable through an environment variable? Recommended first version: fixed/default `20` unless the existing config pattern makes configurability cheap.
