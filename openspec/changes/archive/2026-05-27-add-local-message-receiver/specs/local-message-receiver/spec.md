## ADDED Requirements

### Requirement: Receiver Configuration
The local receiver SHALL read its cloud API base URL, receiver token, poll interval, and optional log level from local runtime configuration.

#### Scenario: Required configuration is missing
- **WHEN** the receiver starts without `REMOTE_MESSAGE_API_BASE_URL` or `RECEIVER_TOKEN`
- **THEN** it SHALL fail fast with a clear configuration error before polling or writing to the device

#### Scenario: Poll interval is omitted
- **WHEN** `RECEIVER_POLL_INTERVAL_MS` is not configured
- **THEN** the receiver SHALL use a default interval of about 3000 milliseconds

#### Scenario: API base URL has trailing slashes
- **WHEN** `REMOTE_MESSAGE_API_BASE_URL` ends with one or more slashes
- **THEN** the receiver SHALL still request `/api/messages/next` and `/api/messages/{id}/ack` using valid URLs

### Requirement: Poll Next Message
The local receiver SHALL poll the remote API `GET /api/messages/next` with `Authorization: Bearer <RECEIVER_TOKEN>`.

#### Scenario: No message is available
- **WHEN** the API returns a successful response with `message: null`
- **THEN** the receiver SHALL NOT write to the K20 GT screen and SHALL continue polling later

#### Scenario: Sticky message is available
- **WHEN** the API returns a successful response with a `sticky` message
- **THEN** the receiver SHALL attempt to write the message text to the K20 GT screen

#### Scenario: Transient message is available
- **WHEN** the API returns a successful response with a `transient` message
- **THEN** the receiver SHALL attempt to write the message text to the K20 GT screen without locally blocking for `displaySeconds`

### Requirement: Acknowledge After Screen Write
The local receiver SHALL acknowledge a message only after the local screen write succeeds.

#### Scenario: Screen write succeeds
- **WHEN** the receiver writes a returned message to the K20 GT screen without error
- **THEN** it SHALL call `POST /api/messages/{id}/ack` with the receiver bearer token

#### Scenario: Screen write fails
- **WHEN** writing a returned message to the K20 GT screen throws or rejects
- **THEN** the receiver SHALL NOT call the ack endpoint for that message and SHALL continue polling later

#### Scenario: Ack request fails
- **WHEN** the ack endpoint returns an error or cannot be reached after a successful screen write
- **THEN** the receiver SHALL log the ack failure and SHALL continue polling later

### Requirement: Resilient Poll Loop
The local receiver SHALL keep the polling loop alive across recoverable API, JSON, and device errors.

#### Scenario: Next request fails
- **WHEN** the next-message request fails, returns a non-success status, or returns invalid JSON
- **THEN** the receiver SHALL log the failure and SHALL continue polling later

#### Scenario: Ctrl+C is received
- **WHEN** the user sends an interrupt signal to the running receiver
- **THEN** the receiver SHALL stop scheduling new polls and exit gracefully

### Requirement: Shared Screen Writer Compatibility
The receiver and the existing screen CLI SHALL share the same K20 GT screen-writing implementation.

#### Scenario: Existing screen command is used
- **WHEN** the user runs `npm run screen -- "今天别熬夜"`
- **THEN** the command SHALL continue to send the provided text to the K20 GT using the known visible custom-text write sequence
