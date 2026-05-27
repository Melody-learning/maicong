## Why

The K20 GT currently supports local custom text writes, but the product should not freeze remote-message limits around the official UI's 32-character cap before the lower-level screen behavior is understood. This change creates a focused exploration track for long text, scrolling, and display-layer boundaries before designing the remote API and local receiver.

## What Changes

- Add a small-step probing plan for `cmd 29` text length, UTF-8 byte limits, and visible truncation behavior.
- Explore `cmd 29` `testType`, `align`, and `scroll` values and record which combinations visibly work.
- Explore whether multi-write refreshes, segmentation, or scrolling patterns can produce a usable long-text experience.
- Compare custom text display behavior with the official lyric display layer, including priority, covering, and recovery behavior.
- Evaluate whether a lyric-style or other existing protocol path is better suited for long text than custom text.
- Define safe exploration boundaries: no official client directory changes, no remote delivery implementation, writes must be interruptible and documented.

## Capabilities

### New Capabilities

- `long-text-display-probing`: Defines the experiment scope, safety rules, evidence to collect, and acceptance criteria for K20 GT long-text and display-layer capability probing.

### Modified Capabilities

- None.

## Impact

- Affected files: `K20GT_RESEARCH.md`, `AGENTS.md`, and small local probing scripts or options around `k20gt-screen.js`.
- Affected systems: local HID writes to the connected `MCHOSE K20 GT` screen through `node-hid`.
- No new remote API, cloud storage, receiver daemon, web sender, packaging, or official-client modification is included in this change.
