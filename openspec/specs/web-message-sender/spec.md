# web-message-sender Specification

## Purpose

Defines the first browser-based sender UI for creating K20 GT screen messages and clearing the current sticky message through the existing remote message API.
## Requirements
### Requirement: Browser Sender Entry
The system SHALL provide a browser-accessible sender page in the Vercel project without requiring a frontend framework.

#### Scenario: Root page opens sender
- **WHEN** a user opens the configured sender path
- **THEN** the system displays a usable message sending interface as the first screen.

#### Scenario: Mobile and desktop usability
- **WHEN** the sender page is viewed on common mobile or desktop widths
- **THEN** the primary token, text, send, and clear controls remain visible and usable without overlapping content.

### Requirement: Send Token Handling
The sender page SHALL use a user-provided send token for sender API calls and SHALL NOT expose or request the receiver token.

#### Scenario: Sender enters token
- **WHEN** a user enters a send token in the page
- **THEN** subsequent create and clear requests include `Authorization: Bearer <token>`.

#### Scenario: Token can be remembered locally
- **WHEN** a user enables or leaves enabled first-version token remembering
- **THEN** the page stores the send token in browser storage for later visits.

#### Scenario: Receiver token is not requested
- **WHEN** the page is displayed
- **THEN** it does not ask for, display, or document a receiver token as a page input.

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
