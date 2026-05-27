# Receiver Display Ownership and Controls Report

Date: 2026-05-28

Implementation update: OpenSpec change `add-receiver-display-controls` implemented the first version of these controls with a receiver-only dismiss endpoint, receiver-local DND, and a JSON one-shot control file. Automatic HID local-takeover detection remains future work.

## Background

The current receiver can already release remote custom-text occupation after remote display ends. It restores a known baseline by writing the confirmed fallback screen state payload, then re-enables the lyric switch:

```text
cmd 9 payload [1,112,241,142,0,0,2]
cmd 11 lyricSwitch=1
```

This solves the natural end-of-message path, but it does not yet solve the case where the local user changes the K20 GT display through MCHOSE HUB while a remote sticky or transient is active.

If the receiver keeps treating remote sticky as an always-owned display target, the user may see this bad experience:

```text
User sets a local preset in MCHOSE HUB
-> screen changes briefly
-> next receiver poll writes the old remote sticky again
```

This is not a protocol failure. It is an ownership-model problem.

## Core Product Model

Remote delivery should be modeled as inserted messages, not as the new owner of the device display system.

```text
K20 GT native display system
  - official preset/time/custom display
  - lyric overlay
  - local MCHOSE HUB operations

Remote receiver
  - inserts sticky/transient messages
  - borrows display temporarily
  - must yield to local user intent
```

The receiver does not own the screen. It borrows it.

## Final Direction From Discussion

The better abstraction is not just "pause/close remote display." The better abstraction is:

- Current remote content is a message.
- A message can be marked as read/dismissed.
- Do Not Disturb controls whether future remote messages may enter.

This separates two user intents:

```text
Read / dismiss current message
  = I have dealt with this current inserted message. Do not show this one again.

Do Not Disturb
  = I need the screen for local use now. Do not show incoming remote messages.
```

## Message Dismiss Semantics

When the local user actively changes the device display while a remote message is active, treat that as dismissing the current remote message.

Examples of local takeover:

- User changes preset/display mode in MCHOSE HUB.
- User changes official custom display text.
- Future: user clicks a local "read" or "close current message" control.

Expected behavior:

```text
Remote message is visible
-> local user changes display
-> receiver detects local takeover
-> receiver marks current remote message as dismissed/read on server
-> receiver stops rewriting that message
-> later new messages can still arrive normally
```

This directly fixes the "local preset appears then gets overwritten one second later" problem.

## Server-Side Dismiss Is Preferred

Dismiss/read should be supported by the server, not only tracked locally in receiver memory.

Reason:

- The message lifecycle belongs to the message system.
- If a sticky is dismissed locally but the server does not know, `/next` will keep returning it.
- Pure local skip would create split brain: receiver thinks the message is dismissed, sender/server still thinks it is active.

Recommended API addition:

```text
POST /api/messages/{id}/dismiss
Authorization: Bearer <RECEIVER_TOKEN>
```

Implemented state semantics:

```text
transient -> dismissed/read/shown equivalent
sticky    -> dismissed/read/expired equivalent, removed from current sticky target
```

Product language is "已读" or "关闭当前消息"; storage maps this to the existing `shown/expired` model instead of adding a new `dismissed` status.

## Do Not Disturb Semantics

Do Not Disturb is different from dismiss.

Dismiss affects the current message. Do Not Disturb affects future display permission.

Expected behavior:

```text
DND off:
  receiver may write remote messages normally

DND on:
  receiver skips /next
  receiver does not write remote messages
  receiver does not ack messages it did not display
  transient messages rely on TTL and may expire naturally
  sticky messages remain server-side unless cleared or dismissed
```

This aligns with the existing TTL model:

- No new postponed/ignored state is required for the first version.
- If a transient is still valid when DND turns off, it may still be shown.
- If it expired, it is gone.
- This preserves the "not a notification inbox" principle.

## Local Takeover Versus DND

Local takeover should not necessarily turn on DND.

Instead:

```text
Local takeover while a message is active
  -> dismiss/read current message
  -> allow future messages as usual

User explicitly enables DND
  -> block future remote display until DND is disabled
```

This distinction is important:

- If the user only wanted to remove the current remote note, future notes should still work.
- If the user really needs the screen, they should use DND.

## Relationship To Sticky

Sticky remains a sustained remote target, but it is no longer unstoppable.

Updated sticky lifecycle:

```text
sticky remains visible until:
  - replaced by a newer sticky
  - cleared by sender
  - dismissed/read by local user
  - expired if configured with TTL
```

This makes sticky feel like a remote note, not like a hostile permanent screen owner.

## Relationship To Lyrics

Lyric restore is still useful but should not be overloaded.

Confirmed:

- `cmd 11 lyricSwitch=1` can restore lyric overlay behavior.
- The receiver does not need to preserve lyric text.
- The device/official path supplies lyrics when available.

But lyric activity should not be required for the first display-control design.

Possible future enhancement:

- Detect whether lyrics are actively displaying.
- Insert remote transient only during lyric gaps or choose a less intrusive timing.

This is useful, but current readback may not reliably represent actual foreground display. It should remain an enhancement, not a dependency for dismiss/DND.

## Implemented Change

OpenSpec change `add-receiver-display-controls` implemented:

1. Add server-side dismiss/read endpoint for current messages.
2. Add receiver support for dismissing the currently active remote message.
3. Document local takeover detection boundary and defer automatic detection.
4. Add Do Not Disturb state for receiver.
5. Ensure DND means no write and no ack for undisplayed messages.
6. Keep TTL as the mechanism for transient expiry during DND.
7. Keep restore behavior from `add-receiver-display-restore` for natural message end/release.

The first real control surface is a receiver-local JSON file, default `receiver-control.json`:

```json
{ "command": "dismiss" }
{ "command": "dnd", "enabled": true }
{ "command": "dnd", "enabled": false }
```

## Open Design Questions

- How should local takeover be detected reliably?
  - Read current screen state before each rewrite?
  - Compare current state with last receiver-owned state?
  - Detect changes in `cmd 9` state, custom text state, or both?

- How should local takeover be detected reliably enough for automatic dismiss?
- Should a later version expose receiver DND state to the sender UI?
- Should the next local user experience be a tray app button that writes the control file or calls the exported helpers directly?

## Summary

The final model is:

```text
Remote content = inserted message
Local takeover = read/dismiss current message
Do Not Disturb = block future remote display
Restore = return screen to native baseline/lyrics after remote message ends
```

This avoids the unpleasant "local setting gets immediately overwritten" behavior while keeping future remote messages useful. It also fits the existing message lifecycle and TTL model instead of adding a premature postponed/ignored queue.
