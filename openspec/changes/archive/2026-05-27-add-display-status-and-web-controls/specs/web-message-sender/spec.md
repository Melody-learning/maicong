## MODIFIED Requirements

### Requirement: Browser Sender Entry
The system SHALL provide a browser-accessible sender page in the Vercel project without requiring a frontend framework.

#### Scenario: Root page shows status and sender
- **WHEN** a user opens the configured sender path
- **THEN** the system displays both the message sending interface and a compact remote display status area as the first screen.

### Requirement: Send Token Handling
The sender page SHALL use a user-provided send token for sender API calls and SHALL NOT expose or request the receiver token.

#### Scenario: Status uses sender token
- **WHEN** the page refreshes display status
- **THEN** it calls `GET /api/display/status` with `Authorization: Bearer <SEND_TOKEN>`.

## ADDED Requirements

### Requirement: Display Status UI
The sender page SHALL show the current remote display and receiver status using sender-readable labels.

#### Scenario: Receiver status is shown
- **WHEN** display status is loaded
- **THEN** the page shows whether the receiver is recently online and whether receiver-local DND is enabled.

#### Scenario: Current sticky is shown
- **WHEN** display status includes a current sticky
- **THEN** the page shows the sticky text and product display state.

#### Scenario: Pending transient count is shown
- **WHEN** display status includes pending transient messages
- **THEN** the page shows the pending transient count.

#### Scenario: DND is read-only
- **WHEN** receiver-local DND is shown in the web sender
- **THEN** the page does not provide a sender-token DND toggle and indicates that DND is controlled locally.

#### Scenario: Status refresh failure is readable
- **WHEN** refreshing display status fails
- **THEN** the page shows a readable error without clearing the send token or exposing receiver token requirements.

## MODIFIED Requirements

### Requirement: Clear Sticky UI
The sender page SHALL allow users to clear the current sticky message with the send token.

#### Scenario: Clear refreshes display status
- **WHEN** sticky clearing succeeds
- **THEN** the page refreshes or updates the status area so the cleared state is visible.
