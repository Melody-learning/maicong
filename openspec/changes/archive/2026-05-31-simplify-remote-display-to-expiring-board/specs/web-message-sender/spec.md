## ADDED Requirements

### Requirement: Board Creation UI
The sender page SHALL allow users to write a single expiring board using product-facing small-blackboard language.

#### Scenario: Create board with duration
- **WHEN** a user enters text, chooses a duration, and submits with a valid send token
- **THEN** the page sends `POST /api/board` with the entered text and selected `durationSeconds`.

#### Scenario: Prevent duplicate board submit while loading
- **WHEN** a create-board request is in progress
- **THEN** the page disables controls that would submit the same action again until the request completes.

#### Scenario: Board creation succeeds
- **WHEN** board creation succeeds
- **THEN** the page shows a readable success state and refreshes the status area.

### Requirement: Clear Board UI
The sender page SHALL allow users to clear the current board with the send token.

#### Scenario: Clear board refreshes display status
- **WHEN** board clearing succeeds
- **THEN** the page refreshes or updates the status area so the cleared state is visible.

#### Scenario: Clear board succeeds when empty
- **WHEN** clearing succeeds while no current board exists
- **THEN** the page shows a readable already-empty result.

## MODIFIED Requirements

### Requirement: User-Readable API Feedback
The sender page SHALL show success and failure feedback using API response details where available.

#### Scenario: Board create succeeds
- **WHEN** board creation succeeds
- **THEN** the page shows a readable success state for writing to the small blackboard.

#### Scenario: Clear succeeds
- **WHEN** board clearing succeeds
- **THEN** the page shows a readable result for cleared or already-empty state.

#### Scenario: Known API error appears
- **WHEN** the API returns errors such as `unauthorized`, `validation_failed`, or `rate_limited`
- **THEN** the page shows a readable message that includes the returned error type.

### Requirement: Display Status UI
The sender page SHALL show the current board and receiver status using sender-readable labels.

#### Scenario: Receiver status is shown
- **WHEN** display status is loaded
- **THEN** the page shows whether the receiver is recently online and whether receiver-local DND is enabled.

#### Scenario: Current board is shown
- **WHEN** display status includes a current board
- **THEN** the page shows the board text and expiration timing.

#### Scenario: Empty board is shown
- **WHEN** display status does not include a current board
- **THEN** the page shows that the small blackboard is empty.

#### Scenario: Queue status is not shown
- **WHEN** display status is loaded
- **THEN** the page does not show sticky state or pending transient count.

#### Scenario: DND is read-only
- **WHEN** receiver-local DND is shown in the web sender
- **THEN** the page does not provide a sender-token DND toggle and indicates that DND is controlled locally.

#### Scenario: Status refresh failure is readable
- **WHEN** refreshing display status fails
- **THEN** the page shows a readable error without clearing the send token or exposing receiver token requirements.

## REMOVED Requirements

### Requirement: Message Creation UI
**Reason**: Sticky/transient sender choices are replaced by a single board creation flow with explicit duration.
**Migration**: Use the board creation UI and choose a duration.

### Requirement: Clear Sticky UI
**Reason**: Sticky clearing is replaced by current-board clearing.
**Migration**: Use the board clear control backed by `DELETE /api/board`.
