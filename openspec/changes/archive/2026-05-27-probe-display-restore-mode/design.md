## Context

The current visible remote-write sequence disables lyric display, switches the device to the custom-text foreground state with `cmd 9`, then writes `cmd 29`. That is good enough for showing remote messages, but it leaves the screen in a remote custom-text baseline unless the official client or another command changes the display mode later.

Manual official-client observation added an important clue: if music is playing and lyric mode is toggled off then on, the device or official path automatically resumes the current lyric. That suggests the receiver does not need to preserve lyric text itself. The missing piece is a script-level restore sequence: lyric switch restoration, and ideally a command that returns the baseline to personalized preset/time instead of the last remote custom text.

## Goals / Non-Goals

**Goals:**

- Add finite probe commands that make lyric off/on restoration observable from the script.
- Add a small, labeled screen-state candidate matrix centered on `cmd 9`.
- Distinguish lyric overlay restoration from baseline display restoration.
- Record command payloads, visible effects, and recommended receiver restore sequence for later implementation.
- Leave the receiver, API, sender, packaging, and official client files unchanged.

**Non-Goals:**

- No receiver restore implementation.
- No automatic detection of whether music is currently playing.
- No guarantee that official custom-text content can be restored.
- No unbounded fuzzing of `cmd 9`, unknown commands, image upload, or official-client internals.
- No long-running background control loop.

## Decisions

1. Extend the existing local probe script instead of creating a new daemon.

   `k20gt-probe.js` already contains finite manual-observation probes and prints JSON summaries. Keeping restore exploration there makes the safety model obvious and avoids product behavior leaking into receiver code before the command sequence is known.

   Alternative considered: implement restore in `k20gt-receiver.js` directly and observe it through real messages. That would mix protocol research with user-facing behavior and make failures more disruptive.

2. Add generic low-level helpers only where they improve labeled probing.

   The writer already exports `writeCustomTextScreenState`, but it only writes one hard-coded payload. Restore probing needs a bounded `cmd 9` matrix, so the shared module should expose a clear `writeScreenState(payload)` helper while preserving existing APIs.

   Alternative considered: duplicate packet construction inside the probe script. That would make candidate payloads harder to reuse in the later receiver change.

3. Treat visible screen behavior as the result, not HID write success.

   Prior probes showed cache and foreground state can differ. Each restore probe should print command payloads and labels, then leave room for human observation of whether lyrics resumed, whether time/preset returned, and whether remote custom text remained as the baseline.

   Alternative considered: rely only on `readLyricState` / `readScreenTextState`. Readback is useful supporting evidence but does not prove the foreground display mode.

4. Keep the candidate matrix intentionally small.

   The first matrix should include the known custom-text state and nearby state-index variations only. If those do not find the time/preset baseline, the notes should narrow the open question rather than escalate to broad fuzzing.

   Alternative considered: enumerate large ranges of `cmd 9` payload bytes. That is not appropriate for a device-facing change whose goal is recoverable low-disturbance probing.

## Risks / Trade-offs

- Lyric resume can only be confirmed when music with lyrics is currently playing -> probes label the required manual setup and record inconclusive results separately.
- A `cmd 9` candidate may change a setting without obvious visible feedback -> probes use delays, labels, and known recovery steps.
- The correct baseline command may not be in the bounded matrix -> document the narrowed gap and keep `add-receiver-display-restore` scoped to confirmed lyric restoration plus best-known baseline behavior.
- Re-enabling lyric mode may overlay remote text only while lyrics are available -> release notes must distinguish overlay from baseline cleanup.
