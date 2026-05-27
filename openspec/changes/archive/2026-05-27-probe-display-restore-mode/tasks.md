## 1. OpenSpec Setup

- [x] 1.1 Create proposal, design, spec, and task artifacts for `probe-display-restore-mode`.
- [x] 1.2 Validate the change artifacts before implementation.

## 2. Probe Helpers

- [x] 2.1 Review current writer/probe exports for lyric state, custom text state, and readback behavior.
- [x] 2.2 Add a clear bounded helper for writing arbitrary `cmd 9` screen-state payloads.
- [x] 2.3 Keep existing custom-text write behavior unchanged for CLI and receiver users.

## 3. Restore Probe Commands

- [x] 3.1 Add `restore-lyric` probe with labeled on/off/on steps, configurable delay, readback, and finite execution.
- [x] 3.2 Add `restore-state` probe with a small labeled `cmd 9` candidate matrix centered on the known custom-text foreground state.
- [x] 3.3 Add `release` probe that starts from visible remote text and separately tests lyric re-enable, baseline candidates, and known custom-text recovery.
- [x] 3.4 Update `npm run probe -- help` output for all new restore commands.

## 4. Joint Observation Tests

- [x] 4.1 Lyric switch check: with a song that has visible lyrics playing, run only `restore-step lyric-off`, then only `restore-step lyric-on`; record whether lyrics resume and what baseline appears while lyrics are off.
- [x] 4.2 Remote baseline check: run only `restore-step remote-text "REMOTE BASE"` and then `restore-step lyric-on`; observe for at least one lyric/no-lyric transition and record whether `REMOTE BASE` remains underneath lyrics.
- [x] 4.3 Baseline candidate check: from a known remote custom-text baseline, test `candidate-mode-0/1/2/4` one at a time with `restore-step`, recording whether any candidate returns to time/preset or merely leaves remote text/lyrics behavior unchanged.

## 5. Documentation

- [x] 5.1 Update `K20GT_RESEARCH.md` with a "Display restore probes" section covering commands, observation template, and current observations or pending manual-observation slots.
- [x] 5.2 Record joint observation results for lyric switch, remote baseline, and baseline candidates.
- [x] 5.3 Update `AGENTS.md` with confirmed facts or narrowed open questions, keeping the next implementation step as `add-receiver-display-restore`.

## 6. Official Client Clue Capture

- [x] 6.1 Record the observed official-client behavior: manually setting a preset/custom display in MCHOSE HUB replaces the `REMOTE BASE` remote custom-text baseline.
- [x] 6.2 Identify a safe capture path that does not modify the official `MCHOSE HUB` installation directory, preferring existing renderer HID logging hooks, DevTools monkeypatching, or external USB/HID capture.
- [x] 6.3 Capture or otherwise derive the exact HID command sequence for the official operation that replaces `REMOTE BASE`, then decode it into report id, command, and payload candidates.
- [x] 6.4 If a concrete candidate sequence is found, replay it once with a single-step probe and record whether it restores/replaces the baseline as expected.

## 7. Verification

- [x] 7.1 Confirm `npm run probe -- help` displays restore commands.
- [x] 7.2 Run automated tests with `npm test`.
- [x] 7.3 Validate OpenSpec with `openspec validate probe-display-restore-mode --strict`.
- [x] 7.4 Confirm no official `MCHOSE HUB` installation directory files were modified.
