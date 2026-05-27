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

### Requirement: Message Creation UI
The sender page SHALL allow users to create sticky and transient messages using product-facing labels.

#### Scenario: Create sticky via "贴上去"
- **WHEN** a user selects "贴上去", enters text, and submits with a valid send token
- **THEN** the page sends `POST /api/messages` with `type: "sticky"` and the entered text.

#### Scenario: Create transient via "显示一下"
- **WHEN** a user selects "显示一下", enters text, and submits with a valid send token
- **THEN** the page sends `POST /api/messages` with `type: "transient"` and the entered text.

#### Scenario: Prevent duplicate submit while loading
- **WHEN** a create request is in progress
- **THEN** the page disables controls that would submit the same action again until the request completes.

### Requirement: Clear Sticky UI
The sender page SHALL allow users to clear the current sticky message with the send token.

#### Scenario: Clear refreshes display status
- **WHEN** sticky clearing succeeds
- **THEN** the page refreshes or updates the status area so the cleared state is visible.

### Requirement: User-Readable API Feedback
The sender page SHALL show success and failure feedback using API response details where available.

#### Scenario: Create succeeds
- **WHEN** message creation succeeds
- **THEN** the page shows a readable success state that distinguishes "贴上去" and "显示一下".

#### Scenario: Clear succeeds
- **WHEN** sticky clearing succeeds
- **THEN** the page shows a readable result for cleared or already-empty state.

#### Scenario: Known API error appears
- **WHEN** the API returns errors such as `unauthorized`, `validation_failed`, `rate_limited`, or `queue_full`
- **THEN** the page shows a readable message that includes the returned error type.

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
