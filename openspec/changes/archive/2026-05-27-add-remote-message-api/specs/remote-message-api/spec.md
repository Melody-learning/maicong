## ADDED Requirements

### Requirement: Token-Protected Remote Message API
The system SHALL expose remote message API endpoints that require token authentication before reading or mutating message state.

#### Scenario: Sender token creates a message
- **WHEN** `POST /api/messages` is called with a valid `SEND_TOKEN`
- **THEN** the system accepts the request for message creation if the payload is otherwise valid.

#### Scenario: Receiver token pulls the next message
- **WHEN** `GET /api/messages/next` is called with a valid `RECEIVER_TOKEN`
- **THEN** the system returns the next scheduled message or `null`.

#### Scenario: Receiver token acknowledges a message
- **WHEN** `POST /api/messages/{id}/ack` is called with a valid `RECEIVER_TOKEN`
- **THEN** the system applies the acknowledgement rules for the referenced message.

#### Scenario: Clear accepts authorized token
- **WHEN** `POST /api/messages/clear` is called with a valid `SEND_TOKEN` or `RECEIVER_TOKEN`
- **THEN** the system clears the current sticky message if one exists.

#### Scenario: Invalid token is rejected
- **WHEN** any remote message API endpoint is called without the required token
- **THEN** the system rejects the request without reading or mutating protected message state.

### Requirement: Message Creation Validation
The system SHALL validate remote message creation requests before storing messages.

#### Scenario: Valid sticky is created
- **WHEN** `POST /api/messages` receives type `sticky`, non-empty text within the configured length limit, and an optional valid TTL
- **THEN** the system creates a sticky message with status `pending`.

#### Scenario: Valid transient is created
- **WHEN** `POST /api/messages` receives type `transient`, non-empty text within the configured length limit, valid `ttlSeconds`, and optional valid `displaySeconds`
- **THEN** the system creates a transient message with status `pending`.

#### Scenario: Invalid text is rejected
- **WHEN** message text is empty or exceeds the configured length limit
- **THEN** the system rejects the create request and does not store the message.

#### Scenario: Invalid message type is rejected
- **WHEN** message type is not `sticky` or `transient`
- **THEN** the system rejects the create request and does not store the message.

#### Scenario: Invalid timing values are rejected
- **WHEN** `ttlSeconds` or `displaySeconds` falls outside configured bounds
- **THEN** the system rejects the create request and does not store the message.

### Requirement: Sticky Message Semantics
The system SHALL maintain at most one current effective sticky message.

#### Scenario: New sticky replaces old sticky
- **WHEN** a new sticky message is created while another sticky is current
- **THEN** the system makes the new sticky current and prevents the old sticky from being returned by `next`.

#### Scenario: Sticky can be persistent
- **WHEN** a sticky is created without `ttlSeconds`
- **THEN** the system keeps it eligible for `next` until it is replaced, cleared, or otherwise expired by an explicit operation.

#### Scenario: Sticky ack remains active
- **WHEN** a current sticky message is acknowledged
- **THEN** the system keeps the sticky as the current effective sticky, keeps it out of status `shown`, and updates display metadata such as `lastDisplayedAt`.

#### Scenario: Clear removes current sticky
- **WHEN** the current sticky is cleared
- **THEN** subsequent `next` requests do not return that sticky.

### Requirement: Transient Queue Semantics
The system SHALL maintain a bounded FIFO queue of pending transient messages.

#### Scenario: Pending transients are FIFO
- **WHEN** multiple transient messages are pending
- **THEN** `next` returns them in ascending creation order before returning any sticky message.

#### Scenario: Queue limit rejects new transient
- **WHEN** the pending transient queue has reached the configured maximum
- **THEN** creation of another transient is rejected without adding it to the queue.

#### Scenario: Transient ack becomes shown
- **WHEN** a showing transient is acknowledged
- **THEN** the system marks it `shown` and prevents it from being returned by future `next` requests.

#### Scenario: Showing transient is not repeated before ack
- **WHEN** a transient has already been returned by `next` and is still `showing`
- **THEN** the system does not return the same transient again before acknowledgement.

### Requirement: Next Message Scheduling
The system SHALL schedule messages using transient-first priority, current sticky fallback, and `null` when nothing is eligible.

#### Scenario: Next cleans expired messages first
- **WHEN** `GET /api/messages/next` is called
- **THEN** the system expires messages whose TTL or showing timeout has elapsed before choosing a message to return.

#### Scenario: Next returns pending transient before sticky
- **WHEN** at least one pending transient exists and a sticky also exists
- **THEN** the system returns the oldest pending transient and marks it `showing`.

#### Scenario: Next returns current sticky after transients
- **WHEN** no pending transient exists and a current non-expired sticky exists
- **THEN** the system returns the sticky and marks it `showing` if it was `pending`.

#### Scenario: Next returns null when empty
- **WHEN** no pending transient and no current non-expired sticky exists
- **THEN** the system returns `null` and does not instruct a receiver to change the screen.

#### Scenario: Sticky can be returned repeatedly
- **WHEN** a current non-expired sticky has already been returned before
- **THEN** the system may return it again on later `next` requests because it represents the ongoing target state.

### Requirement: Expiration and Display Timing
The system SHALL enforce TTL and display timing so stale messages are not shown.

#### Scenario: Pending transient expires before display
- **WHEN** a transient's `expiresAt` is earlier than the current time before it is returned
- **THEN** the system marks it `expired` and does not return it from `next`.

#### Scenario: Showing transient expires after timeout
- **WHEN** a showing transient is not acknowledged before its showing timeout or expiration time
- **THEN** the system marks it `expired` and does not return it from `next`.

#### Scenario: Sticky with TTL expires
- **WHEN** a sticky has an `expiresAt` earlier than the current time
- **THEN** the system marks it `expired`, removes it as the current sticky, and does not return it from `next`.

#### Scenario: Default transient timing is applied
- **WHEN** a transient is created without explicit `displaySeconds`
- **THEN** the system uses a default display duration of 20 seconds.

#### Scenario: Default transient TTL is applied
- **WHEN** a transient is created without explicit `ttlSeconds`
- **THEN** the system uses a default TTL of 300 seconds.

### Requirement: Rate Limiting and Abuse Guardrails
The system SHALL apply simple configurable guardrails to reduce spam and accidental overload.

#### Scenario: Sender exceeds rate limit
- **WHEN** create-message requests exceed the configured sender rate limit
- **THEN** the system rejects additional create requests until the limit window allows them.

#### Scenario: Conservative text limit is configurable
- **WHEN** the API starts without an explicit text length configuration
- **THEN** the system uses a conservative default limit of 32 characters without treating that value as a permanent protocol limit.

#### Scenario: Missing configuration fails closed
- **WHEN** required token or Redis configuration is missing
- **THEN** the system does not expose unauthenticated or in-memory production message behavior.

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
