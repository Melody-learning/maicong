## ADDED Requirements

### Requirement: Lyric Restore Probe
The change SHALL provide a finite local probe that can turn lyric display on, off, and on again using script-level HID commands.

#### Scenario: Lyric toggle sequence is observable
- **WHEN** the lyric restore probe is run
- **THEN** it prints labeled steps, `cmd 11` payload details, delays between writes, and readback output when available.

#### Scenario: Lyric resume result is documented
- **WHEN** the lyric restore probe is observed while music with lyrics is playing
- **THEN** `K20GT_RESEARCH.md` records whether lyrics automatically resume after the script turns lyric display back on.

### Requirement: Baseline Screen State Probe
The change SHALL provide a bounded screen-state probe centered on `cmd 9` candidate payloads for returning to personalized preset or time baseline display.

#### Scenario: Screen-state matrix is bounded
- **WHEN** the baseline restore probe is prepared
- **THEN** it defines a finite labeled candidate list, includes the known custom-text foreground payload, and avoids unbounded fuzzing.

#### Scenario: Candidate effects are documented
- **WHEN** a screen-state candidate is tested
- **THEN** the notes record the payload, visible effect, whether time/preset appears, whether lyric behavior changes, and the recovery step.

### Requirement: Remote Release Probe
The change SHALL provide a finite local probe that starts from visible remote custom text and tests release strategies separately.

#### Scenario: Release strategies are separated
- **WHEN** the release probe is run
- **THEN** it separately tests lyric re-enable, baseline screen-state candidates, and known custom-text recovery rather than treating them as the same operation.

#### Scenario: Release model is documented
- **WHEN** release probing is complete or inconclusive
- **THEN** the research notes distinguish stopping remote writes, lyric overlay restoration, baseline mode restoration, and official custom-text restoration.

### Requirement: Probe Safety and Closeout
The change SHALL keep restore probing local, finite, recoverable, and documented.

#### Scenario: Official client directory is untouched
- **WHEN** restore probe code or notes are added
- **THEN** no files under the official `MCHOSE HUB` installation directory are modified.

#### Scenario: Help lists restore probes
- **WHEN** `npm run probe -- help` is run
- **THEN** it lists the restore-related probe commands and their key options.

#### Scenario: Validation passes
- **WHEN** implementation is complete
- **THEN** `npm test` and `openspec validate probe-display-restore-mode --strict` pass.

### Requirement: Joint Observation Protocol
The change SHALL include a small set of joint observation tests where script actions and physical screen observations are recorded one step at a time.

#### Scenario: Single-step observation is used for conclusions
- **WHEN** a visible restore conclusion is recorded
- **THEN** it is based on one `restore-step` action at a time, not on a fast multi-command matrix run.

#### Scenario: Critical observations are recorded
- **WHEN** joint testing is complete
- **THEN** the notes record whether lyric re-enable resumes lyrics, whether remote custom text remains as the baseline under lyrics, and whether any bounded `cmd 9` candidate returns to time or personalized preset.

### Requirement: Official Client Operation Clue
The change SHALL use the official client's observed baseline replacement behavior as a bounded clue source for the missing restore command.

#### Scenario: Official behavior is recorded
- **WHEN** a manual official-client operation replaces a remote custom-text baseline
- **THEN** the research notes record the operation, visible result, and why it is relevant to receiver restore.

#### Scenario: Capture path is safe
- **WHEN** an official-client packet capture path is attempted
- **THEN** it does not modify files under the official `MCHOSE HUB` installation directory.

#### Scenario: Captured command is decoded
- **WHEN** a HID report from the relevant official operation is captured
- **THEN** it is decoded into report id, packet header, command, payload, and a replay candidate when safe.
