## ADDED Requirements

### Requirement: Recent Board History UI
The sender page SHALL show a lightweight recent small-blackboard history using sender-readable labels.

#### Scenario: History is shown
- **WHEN** board history loads successfully
- **THEN** the page shows recent entries using only write time and board text, plus a current marker when applicable.

#### Scenario: Current entry is marked
- **WHEN** a history entry has the current marker from the history API
- **THEN** the page visually labels that entry as current without describing receiver display lifecycle state.

#### Scenario: Empty history is shown
- **WHEN** board history returns no entries
- **THEN** the page shows a readable empty-history state.

#### Scenario: History refreshes after board creation
- **WHEN** board creation succeeds
- **THEN** the page refreshes or updates the recent history so the new board appears.

#### Scenario: History refreshes after clearing current board
- **WHEN** clearing the current board succeeds
- **THEN** the page refreshes or updates the recent history so no cleared entry is incorrectly marked current.

#### Scenario: History refresh failure is readable
- **WHEN** loading recent history fails
- **THEN** the page shows a readable failure state without clearing the send token or requesting the receiver token.
