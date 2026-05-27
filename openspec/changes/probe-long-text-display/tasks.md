## 1. Probe Setup

- [x] 1.1 Review `k20gt-screen.js` packet construction, current 51-byte truncation behavior, and known visible custom-text sequence before adding probe code.
- [x] 1.2 Define a structured observation template in `K20GT_RESEARCH.md` for input text, byte length, parameters, command sequence, visible result, readback result, and recovery step.
- [x] 1.3 Add only minimal local probe support around the existing script, keeping writes finite, interruptible, and reusable for manual observation.

## 2. Cmd 29 Length Boundary

- [x] 2.1 Run baseline visible custom-text tests below the official 32-character limit and record results.
- [x] 2.2 Run boundary tests around 32 characters and around the known about-51 UTF-8 byte payload limit for ASCII, Chinese, emoji, and mixed text.
- [x] 2.3 Record whether over-limit input is rejected, truncated before write, accepted into cache, visibly truncated, scrolls, or fails to foreground.
- [x] 2.4 Update `K20GT_RESEARCH.md` with the observed practical custom-text boundary and update `AGENTS.md` if the first-version product assumption changes.

## 3. Cmd 29 Parameter Matrix

- [x] 3.1 Define a bounded candidate matrix for `testType`, `align`, and `scroll`, including the known-good default values.
- [ ] 3.2 Test each candidate combination with short text and record visibility, alignment, scrolling, cache/foreground differences, and recovery behavior.
- [ ] 3.3 Repeat promising parameter combinations with near-boundary text to see whether behavior changes with length.
- [ ] 3.4 Update `K20GT_RESEARCH.md` with parameter effects and move unresolved values into `AGENTS.md` open questions if needed.

## 4. Long Text Display Strategies

- [ ] 4.1 Test finite segmented writes for one long message using conservative segment sizes and visible delays.
- [ ] 4.2 Test whether timed refreshes or scroll-enabled parameter values produce a readable long-text experience.
- [ ] 4.3 Compare long-text strategies against product needs for `sticky` and `transient` messages, including interruption and return-to-baseline behavior.
- [ ] 4.4 Document the recommended first-version long-text fallback in `K20GT_RESEARCH.md` and summarize any product decision in `AGENTS.md`.

## 5. Lyric and Custom Text Layer Relationship

- [ ] 5.1 Test custom-text writes with lyric display off, lyric display on, and lyric/custom commands sent in different orders.
- [ ] 5.2 Record which layer is visible, whether custom text is only cached, and which sequence restores visible custom text.
- [ ] 5.3 Investigate whether `cmd 11` or another known lyric-related path is better suited for long text than `cmd 29`, without building remote delivery.
- [ ] 5.4 Update `K20GT_RESEARCH.md` and `AGENTS.md` with safe receiver-display assumptions, including whether future remote messages should disable, preserve, restore, or pause around lyric display.

## 6. Closeout

- [ ] 6.1 Verify no files under the official `MCHOSE HUB` installation directory were modified.
- [ ] 6.2 Verify all probe scripts are local, finite or clearly interruptible, and do not implement remote API, queue, receiver daemon, web sender, or packaging.
- [ ] 6.3 Review `K20GT_RESEARCH.md` and `AGENTS.md` for concise, current facts, decisions, and remaining open questions.
- [ ] 6.4 Run OpenSpec status/validation for `probe-long-text-display` and mark tasks complete only after evidence has been recorded.
