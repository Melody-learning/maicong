## MODIFIED Requirements

### Requirement: Token-Protected Remote Message API
The system SHALL expose remote message API endpoints that require token authentication before reading or mutating message state.

#### Scenario: Sender token reads display status
- **WHEN** `GET /api/display/status` is called with a valid `SEND_TOKEN`
- **THEN** the system returns the current product-level display status summary.

#### Scenario: Receiver token updates receiver status
- **WHEN** `POST /api/display/status` is called with a valid `RECEIVER_TOKEN`
- **THEN** the system stores the receiver status summary with a bounded TTL.

#### Scenario: Sender token cannot update receiver status
- **WHEN** `POST /api/display/status` is called with only a valid `SEND_TOKEN`
- **THEN** the system rejects the request without mutating receiver status.

#### Scenario: Receiver token cannot read sender display status
- **WHEN** `GET /api/display/status` is called with only a valid `RECEIVER_TOKEN`
- **THEN** the system rejects the request.

### Requirement: Sticky Message Semantics
The system SHALL maintain at most one current effective sticky message.

#### Scenario: New sticky replaces old sticky
- **WHEN** a new sticky message is created while another sticky is current
- **THEN** the system makes the new sticky current, prevents the old sticky from being returned by `next`, and records the old sticky `endedReason` as `replaced`.

#### Scenario: Clear removes current sticky
- **WHEN** the current sticky is cleared
- **THEN** subsequent `next` requests do not return that sticky and the cleared sticky records `endedReason` as `cleared`.

### Requirement: Transient Queue Semantics
The system SHALL maintain a bounded FIFO queue of pending transient messages.

#### Scenario: Transient ack becomes shown
- **WHEN** a showing transient is acknowledged
- **THEN** the system marks it `shown`, records `endedReason` as `shown`, and prevents it from being returned by future `next` requests.

### Requirement: Expiration and Display Timing
The system SHALL enforce TTL and display timing so stale messages are not shown.

#### Scenario: Pending transient expires before display
- **WHEN** a transient's `expiresAt` is earlier than the current time before it is returned
- **THEN** the system marks it `expired`, records `endedReason` as `ttl_expired`, and does not return it from `next`.

#### Scenario: Showing transient expires after timeout
- **WHEN** a showing transient is not acknowledged before its showing timeout
- **THEN** the system marks it `expired`, records `endedReason` as `showing_timeout`, and does not return it from `next`.

#### Scenario: Sticky with TTL expires
- **WHEN** a sticky has an `expiresAt` earlier than the current time
- **THEN** the system marks it `expired`, records `endedReason` as `ttl_expired`, removes it as the current sticky, and does not return it from `next`.

## ADDED Requirements

### Requirement: Message Dismiss Semantics
The system SHALL allow the receiver to dismiss/read a message so it is no longer scheduled for display.

#### Scenario: Current sticky is dismissed
- **WHEN** `POST /api/messages/{id}/dismiss` is called for the current sticky
- **THEN** the system marks that sticky expired, records `endedReason` as `dismissed`, removes it as current sticky, and later `next` requests do not return it.

#### Scenario: Pending transient is dismissed
- **WHEN** `POST /api/messages/{id}/dismiss` is called for a pending transient
- **THEN** the system marks that transient shown with `endedReason=dismissed` and later `next` requests do not return it.

#### Scenario: Showing transient is dismissed
- **WHEN** `POST /api/messages/{id}/dismiss` is called for a showing transient
- **THEN** the system marks that transient shown with `endedReason=dismissed` and later `next` requests do not return it.

### Requirement: Public Display Status Summary
The system SHALL provide a sender-readable product-level display status summary without exposing receiver secrets.

#### Scenario: Display status includes receiver summary
- **WHEN** `GET /api/display/status` succeeds
- **THEN** the response includes receiver DND, `lastSeenAt`, online-ish status, last status text, last display message id/type, and remote display active flag.

#### Scenario: Display status includes message summaries
- **WHEN** `GET /api/display/status` succeeds
- **THEN** the response includes current sticky summary, pending transient count, and current remote display message summary when known.

#### Scenario: Public messages include display fields
- **WHEN** any API returns a public message
- **THEN** the message includes `displayState`, `endedReason`, and `endedAt` fields while preserving existing message fields.
