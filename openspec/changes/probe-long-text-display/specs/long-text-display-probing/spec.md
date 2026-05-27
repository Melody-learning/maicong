## ADDED Requirements

### Requirement: Cmd 29 Length Boundary Probe
The change SHALL determine the practical `cmd 29` custom-text boundary for remote-message planning, including attempted UTF-8 byte length, accepted payload length, visible truncation behavior, and differences between ASCII, Chinese, emoji, and mixed text.

#### Scenario: Length probe is recorded
- **WHEN** a `cmd 29` length experiment is run
- **THEN** the result records the input text category, character count, UTF-8 byte count, payload byte count sent, parameter values, write/readback result when available, visible screen behavior, and conclusion.

#### Scenario: Boundary conclusion is documented
- **WHEN** length experiments cover below, at, and above the known 32-character and about-51-byte boundaries
- **THEN** `K20GT_RESEARCH.md` documents the observed safe boundary and any difference between protocol acceptance and visible usability.

### Requirement: Cmd 29 Parameter Probe
The change SHALL explore observable `cmd 29` `testType`, `align`, and `scroll` parameter values using a bounded matrix and a known-good baseline.

#### Scenario: Parameter matrix is bounded
- **WHEN** parameter probing is prepared
- **THEN** the probe defines finite candidate values, includes the known-good default, and avoids unbounded fuzzing.

#### Scenario: Parameter effect is documented
- **WHEN** a parameter combination is tested
- **THEN** the notes record whether text became visible, how alignment or scrolling changed, whether cached state differed from foreground display, and what recovery step was used.

### Requirement: Long Text Experience Probe
The change SHALL test whether repeated writes, segmentation, or timed refreshes can create a usable long-text experience without implementing remote delivery.

#### Scenario: Segmented display is evaluated
- **WHEN** a long message is displayed through multiple custom-text writes
- **THEN** the result records segment sizing, timing, transitions, readability, interruption behavior, and whether the screen returns to a known baseline.

#### Scenario: Product recommendation is captured
- **WHEN** long-text strategies have been compared
- **THEN** `AGENTS.md` or `K20GT_RESEARCH.md` records the recommended first-version fallback, such as 32-character cap, 51-byte cap, segmentation, scrolling, lyric path, or no long-text support yet.

### Requirement: Display Layer Relationship Probe
The change SHALL characterize the relationship between official lyric display behavior and custom text display behavior.

#### Scenario: Layer priority is observed
- **WHEN** lyric-layer and custom-text commands are tested in different orders
- **THEN** the result records which layer is visible, whether one layer covers the other, whether `cmd 29` only updates cache, and which command sequence restores visible custom text.

#### Scenario: Safer remote-message default is documented
- **WHEN** layer relationship probing is complete
- **THEN** the notes document whether a future receiver should disable lyric display by default, preserve it, restore it, or expose a pause/do-not-disturb mode before writing messages.

### Requirement: Probe Safety and Documentation
The change SHALL keep device-facing exploration recoverable, local, and documented.

#### Scenario: Official client directory is untouched
- **WHEN** probe scripts or notes are added
- **THEN** no files under the official `MCHOSE HUB` installation directory are modified.

#### Scenario: Probe writes are interruptible
- **WHEN** a probe performs repeated screen writes
- **THEN** it has a finite run or clear exit path and documents how to recover the screen to a known state.

#### Scenario: Research notes stay current
- **WHEN** an experiment confirms, rejects, or changes an assumption
- **THEN** `K20GT_RESEARCH.md` is updated with the device/protocol fact and `AGENTS.md` is updated with concise iteration progress, product decision, or remaining open question as appropriate.
