## Purpose

Provide a token-protected cloud relay API for K20 GT screen messages, including message creation, scheduling, acknowledgement, expiry, rate limiting, and sticky clearing without implementing local receiver or HID display behavior.
## Requirements
### Requirement: Token-Protected Remote Message API
The system SHALL expose board API endpoints that require token authentication before reading or mutating board and receiver display state.

#### Scenario: Sender token creates a board
- **WHEN** `POST /api/board` is called with a valid `SEND_TOKEN`
- **THEN** the system accepts the request for board creation if the payload is otherwise valid.

#### Scenario: Authorized token reads current board
- **WHEN** `GET /api/board` is called with a valid `SEND_TOKEN` or `RECEIVER_TOKEN`
- **THEN** the system returns the current unexpired board or `null`.

#### Scenario: Receiver token reports displayed board
- **WHEN** `POST /api/board/{id}/displayed` is called with a valid `RECEIVER_TOKEN`
- **THEN** the system applies the displayed-report rules for the referenced board.

#### Scenario: Receiver token dismisses a board
- **WHEN** `POST /api/board/{id}/dismiss` is called with a valid `RECEIVER_TOKEN`
- **THEN** the system applies the dismiss rules for the referenced board.

#### Scenario: Sender token cannot dismiss a board
- **WHEN** `POST /api/board/{id}/dismiss` is called with only a valid `SEND_TOKEN`
- **THEN** the system rejects the request without mutating board state.

#### Scenario: Sender token clears current board
- **WHEN** `DELETE /api/board` is called with a valid `SEND_TOKEN`
- **THEN** the system clears the current board if one exists.

#### Scenario: Invalid token is rejected
- **WHEN** any board API endpoint is called without the required token
- **THEN** the system rejects the request without reading or mutating protected board state.

### Requirement: Message Creation Validation
The system SHALL validate board creation requests before storing a board.

#### Scenario: Valid board is created
- **WHEN** `POST /api/board` receives non-empty text within the configured length limit and valid `durationSeconds`
- **THEN** the system creates a current board with an expiration time.

#### Scenario: Invalid text is rejected
- **WHEN** board text is empty or exceeds the configured length limit
- **THEN** the system rejects the create request and does not store a board.

#### Scenario: Legacy message type is rejected
- **WHEN** a create request provides sticky/transient `type` semantics instead of board duration semantics
- **THEN** the system rejects the create request and does not store a board.

#### Scenario: Invalid duration is rejected
- **WHEN** `durationSeconds` is omitted or falls outside configured bounds
- **THEN** the system rejects the create request and does not store a board.

### Requirement: Rate Limiting and Abuse Guardrails
The system SHALL apply simple configurable guardrails to reduce spam and accidental overload.

#### Scenario: Sender exceeds rate limit
- **WHEN** board creation requests exceed the configured sender rate limit
- **THEN** the system rejects additional create requests until the limit window allows them.

#### Scenario: Conservative text limit is configurable
- **WHEN** the API starts without an explicit text length configuration
- **THEN** the system uses a conservative default limit of 32 characters without treating that value as a permanent protocol limit.

#### Scenario: Board duration bounds are configurable
- **WHEN** the API starts without explicit duration bounds
- **THEN** the system uses conservative minimum and maximum board duration bounds.

#### Scenario: Missing configuration fails closed
- **WHEN** required token or Redis configuration is missing
- **THEN** the system does not expose unauthenticated or in-memory production board behavior.

### Requirement: Scope Boundaries
The change SHALL implement only the cloud message API and SHALL NOT implement local device display behavior.

#### Scenario: Receiver is out of scope
- **WHEN** this change is completed
- **THEN** there is no local polling receiver, tray app, Windows service, or HID write integration added by this change.

#### Scenario: Sender UI is out of scope
- **WHEN** this change is completed
- **THEN** there is no web message sending UI, Telegram integration, WeChat integration, registration, login, multi-user, or multi-device workflow added by this change.

#### Scenario: Display experiments are out of scope
- **WHEN** this change is completed
- **THEN** it does not resolve long-text display, scrolling, lyric layer, custom text layer, or image upload protocol behavior.

### Requirement: Public Display Status Summary
The system SHALL provide a sender-readable product-level display status summary without exposing receiver secrets.

#### Scenario: Display status includes receiver summary
- **WHEN** `GET /api/display/status` succeeds
- **THEN** the response includes receiver DND, `lastSeenAt`, online-ish status, last status text, last display board id, and remote display active flag.

#### Scenario: Display status includes board summary
- **WHEN** `GET /api/display/status` succeeds
- **THEN** the response includes the current unexpired board summary and the current receiver-reported display board summary when known.

#### Scenario: Display status omits queue summary
- **WHEN** `GET /api/display/status` succeeds
- **THEN** the response does not include sticky state, pending transient count, or pending transient summaries.

### Requirement: Single Expiring Board Semantics
The system SHALL maintain at most one current active board and SHALL require every active board to have an expiration time.

#### Scenario: New board replaces old board
- **WHEN** `POST /api/board` creates a board while another board is current
- **THEN** the system makes the new board current, prevents the old board from being returned by board reads, and records the old board as replaced.

#### Scenario: Board has required expiration
- **WHEN** a board is created successfully
- **THEN** the stored board includes `durationSeconds` and `expiresAt`.

#### Scenario: Expired board is not current
- **WHEN** the current board's `expiresAt` is earlier than the current time
- **THEN** the system records the board as expired, removes it as current, and returns `null` for current-board reads.

#### Scenario: Empty board state returns null
- **WHEN** there is no current unexpired board
- **THEN** the board read endpoint returns `board: null` without scheduling any fallback item.

### Requirement: Board Display Reporting
The system SHALL allow the receiver to report that it displayed the current board without making the board terminal.

#### Scenario: Current board is displayed
- **WHEN** `POST /api/board/{id}/displayed` is called for the current unexpired board with a valid receiver token
- **THEN** the system records display timing for that board and keeps the board current until it expires, is replaced, is cleared, or is dismissed.

#### Scenario: Non-current board is displayed
- **WHEN** `POST /api/board/{id}/displayed` is called for an unknown, expired, or non-current board
- **THEN** the system returns safely without making that board current.

### Requirement: Board Clear and Dismiss
The system SHALL support clearing the current board by sender action and dismissing the current board by receiver action.

#### Scenario: Sender clears current board
- **WHEN** `DELETE /api/board` is called with a valid send token and a current board exists
- **THEN** the system clears the current board and prevents it from being returned by later board reads.

#### Scenario: Receiver dismisses current board
- **WHEN** `POST /api/board/{id}/dismiss` is called with a valid receiver token for the current board
- **THEN** the system dismisses the board, removes it as current, and prevents it from being returned by later board reads.

#### Scenario: Unknown board is dismissed
- **WHEN** `POST /api/board/{id}/dismiss` is called for an unknown or non-current board
- **THEN** the system returns safely without mutating unrelated board state.
