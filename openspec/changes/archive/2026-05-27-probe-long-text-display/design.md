## Context

The current workspace has a minimal `node-hid` path that can write custom text to the `MCHOSE K20 GT` screen through HID report `188` on the `MI_03 Col01` endpoint. `k20gt-screen.js` sends a visible custom-text sequence by disabling lyric display, switching the screen state, and sending `cmd 29` with a text payload capped to about 51 UTF-8 bytes.

The product direction is remote screen-message delivery, but the next useful step is protocol exploration, not cloud delivery. The main uncertainty is whether the remote-message model should be limited to the official UI's 32-character custom-text cap, the lower-level `cmd 29` byte cap, a segmented/scrolling custom-text strategy, or a lyric-like display path.

## Goals / Non-Goals

**Goals:**

- Establish the practical text length boundary for `cmd 29`, including UTF-8 byte and visible character behavior.
- Enumerate observable effects of `testType`, `align`, and `scroll` values for custom text.
- Test whether repeated custom-text writes, segmentation, or timed refreshes can create an acceptable long-text experience.
- Characterize lyric layer and custom text layer interactions, including priority, covering, and how to return to a known state.
- Identify safe defaults for later `sticky` and `transient` remote-message display rules.
- Keep research notes and project direction updated after each experiment.

**Non-Goals:**

- No Vercel API, Redis/KV queue, receiver polling loop, web sender, bot integration, tray app, or packaging.
- No modification of the official `MCHOSE HUB` installation directory.
- No long-running background process that continuously controls the speaker screen.
- No claim of reliable production behavior without manual observation and recorded evidence.

## Decisions

1. Use small local probing around the existing HID script.

   The existing `k20gt-screen.js` is already the known-good write path, so experiments should reuse its packet construction and device selection wherever practical. Any new probing script should be narrow, easy to exit, and oriented around one experiment family at a time.

   Alternative considered: implement the receiver abstraction first and hide probing behind it. This is premature because receiver scheduling depends on the display boundaries this change is meant to discover.

2. Record each experiment as a reproducible observation, not just a conclusion.

   Each probe should capture input text, UTF-8 byte length, parameter values, command sequence, expected result, observed screen behavior, and any recovery step. `K20GT_RESEARCH.md` should hold protocol and behavior facts; `AGENTS.md` should keep only concise iteration progress, product decisions, and open questions.

   Alternative considered: only update OpenSpec tasks. That would lose device facts after the change is archived or when future work starts from project notes.

3. Treat visible behavior as the source of truth.

   HID write success only proves the packet was accepted by the host/device path. Experiments must distinguish accepted writes, cached state, and visible foreground display because previous research showed `cmd 29` can update cached custom text without becoming visible.

   Alternative considered: rely on readback commands alone. Readback is useful evidence but insufficient for product UX decisions.

4. Keep device control recoverable.

   Probing commands should prefer explicit setup and teardown steps, such as closing lyric display before custom text checks and documenting how to return to the normal/custom baseline. Experiments should avoid indefinite loops unless they have a visible interval, a finite count, and a clear interrupt path.

   Alternative considered: aggressive fuzzing of command values. That is too risky for a device-facing exploration whose product goal is low disturbance.

## Risks / Trade-offs

- Parameter probing may produce invisible, stale, or confusing screen states -> mitigate by using a known-good baseline write before and after each experiment group.
- Manual observation can be subjective -> mitigate by recording exact input, parameter values, timing, and screen result in a structured table.
- Longer text may be accepted but visually unusable -> mitigate by separating protocol acceptance from product usability in the notes.
- Lyric display experiments may temporarily cover custom text -> mitigate by starting from the known sequence that disables lyric display and documenting recovery.
- Adding probe scripts can accidentally become product code -> mitigate by naming and scoping scripts as probes, with no remote API or daemon behavior.
