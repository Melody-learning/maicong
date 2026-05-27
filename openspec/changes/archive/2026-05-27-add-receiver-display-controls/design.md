## Context

The current product model is:

- Remote content is an inserted message.
- Local takeover should dismiss/read the current message.
- Do Not Disturb blocks future remote display.
- Restore returns the screen to the configured native baseline/lyric switch after remote occupation ends.

The first implementation should provide reliable control primitives without pretending that automatic HID readback can already identify every local MCHOSE HUB takeover.

## Design

### Server Dismiss Endpoint

Add `POST /api/messages/{id}/dismiss`, authorized only by `RECEIVER_TOKEN`.

Dismiss maps to existing storage states instead of adding a new `dismissed` state:

- `sticky`: mark `expired` and remove it from `currentSticky` if it is still current.
- `transient`: mark `shown`, remove it from pending/showing queues, and set `shownAt`.

This keeps the current scheduler simple and matches the existing product effects: dismissed sticky no longer returns as current sticky, and dismissed transient no longer returns. API responses still describe the operation as dismiss/read.

Unknown, expired, or shown messages return a safe success response with `dismissed: false`. The endpoint must not mutate unrelated state.

### Receiver Display Session

Extend the session to keep the current remote message identity:

- `currentMessageId`
- `currentMessageType`
- existing `lastDisplayedMessageId`, `lastDisplayedType`, `activeStickyId`, and `remoteDisplayActive`

Writing and acking a message marks it as current. Restoring clears it. Ack failure after a successful write still marks the message current, because the remote content may already be visible and should be restorable/dismissable.

### Control File

Use a receiver-local JSON control file as the first real control surface. Default:

```text
RECEIVER_CONTROL_FILE=receiver-control.json
```

Supported JSON:

```json
{ "command": "dismiss" }
{ "command": "dnd", "enabled": true }
{ "dnd": true }
```

The receiver checks the file once per poll tick before contacting `/next`. A valid command is applied and the file is deleted so the command is one-shot. Invalid JSON or unknown commands are logged and left in place for the user to fix.

The file is local-only. DND is not stored in cloud state in this version, because it is a permission of this receiver/device rather than a property of a message.

### DND

DND defaults to `RECEIVER_DND=false`.

When DND is on:

- The receiver does not call `/next`.
- It does not write the screen.
- It does not ack undisplayed messages.
- Transients rely on their TTL to expire while DND is active.
- Sticky remains server current unless dismissed or cleared.

Skipping `/next` is safer than polling during DND because the existing `/next` endpoint can move a transient from `pending` to `showing`. Avoiding `/next` preserves the invariant that undisplayed messages are not acknowledged or advanced by the receiver.

When DND is enabled while a remote message is active, the receiver immediately attempts the existing restore sequence once and clears the local display session only if restore succeeds.

When DND turns off, normal polling resumes.

### Dismiss Current Message

Add `dismissCurrentMessage()` or equivalent helper:

1. If no current message is known, return a no-op success.
2. Call `POST /api/messages/{id}/dismiss`.
3. Attempt `restoreDisplay()`.
4. Clear the local display session when restore succeeds.

Dismiss failure logs and keeps the loop alive. Restore failure logs and keeps the loop alive; the local session remains active so a later command or empty poll can retry restore.

### Local Takeover Detection

This change does not implement automatic HID local-takeover detection. Current readback understanding is not strong enough to distinguish every local user action from lyric timing, cached custom text, or normal receiver state. The new dismiss endpoint and local controls are the required foundation for a later tray button or conservative detector.

Future automatic detection should be opt-in and conservative: compare a stable screen-state/custom-text snapshot against the receiver's last-owned state, avoid frequent device reads/writes, and never dismiss when evidence is ambiguous.

## Risks

- A JSON file is a minimal control surface, not a polished user experience. It is still real and testable, and it can be driven by a future tray app.
- DND state is process-local. Restarting the receiver falls back to `RECEIVER_DND` and does not remember a runtime file command.
- Dismiss uses existing `expired`/`shown` states, so storage does not preserve an explicit `dismissed` status. This is acceptable for the first version because the scheduler outcome is the important contract.
