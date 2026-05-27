## MODIFIED Requirements

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

#### Scenario: Receiver token dismisses a message
- **WHEN** `POST /api/messages/{id}/dismiss` is called with a valid `RECEIVER_TOKEN`
- **THEN** the system applies the dismiss/read rules for the referenced message.

#### Scenario: Sender token cannot dismiss a message
- **WHEN** `POST /api/messages/{id}/dismiss` is called with only a valid `SEND_TOKEN`
- **THEN** the system rejects the request without mutating message state.

#### Scenario: Clear accepts authorized token
- **WHEN** `POST /api/messages/clear` is called with a valid `SEND_TOKEN` or `RECEIVER_TOKEN`
- **THEN** the system clears the current sticky message if one exists.

#### Scenario: Invalid token is rejected
- **WHEN** any remote message API endpoint is called without the required token
- **THEN** the system rejects the request without reading or mutating protected message state.

### Requirement: Message Dismiss Semantics
The system SHALL allow the receiver to dismiss/read a message so it is no longer scheduled for display.

#### Scenario: Current sticky is dismissed
- **WHEN** `POST /api/messages/{id}/dismiss` is called for the current sticky
- **THEN** the system marks that sticky expired, removes it as current sticky, and later `next` requests do not return it.

#### Scenario: Pending transient is dismissed
- **WHEN** `POST /api/messages/{id}/dismiss` is called for a pending transient
- **THEN** the system marks that transient shown or otherwise terminal and later `next` requests do not return it.

#### Scenario: Showing transient is dismissed
- **WHEN** `POST /api/messages/{id}/dismiss` is called for a showing transient
- **THEN** the system marks that transient shown or otherwise terminal and later `next` requests do not return it.

#### Scenario: Unknown message is dismissed
- **WHEN** `POST /api/messages/{id}/dismiss` is called for an unknown message id
- **THEN** the system returns a safe success response and does not mutate unrelated state.

#### Scenario: Terminal message is dismissed
- **WHEN** `POST /api/messages/{id}/dismiss` is called for an already expired or shown message
- **THEN** the system returns safely without reactivating or corrupting the message.
