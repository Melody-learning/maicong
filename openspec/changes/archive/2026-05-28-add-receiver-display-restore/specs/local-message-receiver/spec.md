## MODIFIED Requirements

### Requirement: Receiver Configuration
The local receiver SHALL read its cloud API base URL, receiver token, poll interval, optional log level, and optional display restore settings from local runtime configuration.

#### Scenario: Required configuration is missing
- **WHEN** the receiver starts without `REMOTE_MESSAGE_API_BASE_URL` or `RECEIVER_TOKEN`
- **THEN** it SHALL fail fast with a clear configuration error before polling or writing to the device

#### Scenario: Poll interval is omitted
- **WHEN** `RECEIVER_POLL_INTERVAL_MS` is not configured
- **THEN** the receiver SHALL use a default interval of about 3000 milliseconds

#### Scenario: API base URL has trailing slashes
- **WHEN** `REMOTE_MESSAGE_API_BASE_URL` ends with one or more slashes
- **THEN** the receiver SHALL still request `/api/messages/next` and `/api/messages/{id}/ack` using valid URLs

#### Scenario: Restore settings are omitted
- **WHEN** restore-related environment variables are not configured
- **THEN** the receiver SHALL enable restore on empty responses, enable lyric switch restoration, and use fallback screen-state payload `[1,112,241,142,0,0,2]`

#### Scenario: Restore screen state is customized
- **WHEN** `RECEIVER_RESTORE_SCREEN_STATE` is set to a comma-separated byte payload
- **THEN** the receiver SHALL parse and use that payload for display restore

### Requirement: Poll Next Message
The local receiver SHALL poll the remote API `GET /api/messages/next` with `Authorization: Bearer <RECEIVER_TOKEN>`.

#### Scenario: No message is available with no remote display occupation
- **WHEN** the API returns a successful response with `message: null` and the receiver has no active remote display occupation
- **THEN** the receiver SHALL NOT write to the K20 GT screen and SHALL continue polling later

#### Scenario: No message is available after remote display occupation
- **WHEN** the API returns a successful response with `message: null` and the receiver believes remote display is active
- **THEN** the receiver SHALL attempt the configured display restore once before continuing to poll

#### Scenario: Sticky message is available
- **WHEN** the API returns a successful response with a `sticky` message
- **THEN** the receiver SHALL attempt to write the message text to the K20 GT screen and SHALL NOT restore the native baseline while that sticky remains the remote target

#### Scenario: Transient message is available
- **WHEN** the API returns a successful response with a `transient` message
- **THEN** the receiver SHALL attempt to write the message text to the K20 GT screen without locally blocking for `displaySeconds`

#### Scenario: Transient is followed by sticky
- **WHEN** a transient has been displayed and acknowledged and a later next response returns a sticky message
- **THEN** the receiver SHALL write the sticky message and SHALL NOT call display restore between those remote targets

#### Scenario: Transient is followed by no message
- **WHEN** a transient has been displayed and acknowledged and a later next response returns `message: null`
- **THEN** the receiver SHALL attempt the configured display restore

### Requirement: Acknowledge After Screen Write
The local receiver SHALL acknowledge a message only after the local screen write succeeds.

#### Scenario: Screen write succeeds
- **WHEN** the receiver writes a returned message to the K20 GT screen without error
- **THEN** it SHALL call `POST /api/messages/{id}/ack` with the receiver bearer token

#### Scenario: Screen write fails
- **WHEN** writing a returned message to the K20 GT screen throws or rejects
- **THEN** the receiver SHALL NOT call the ack endpoint for that message, SHALL NOT run display restore for that failed write, and SHALL continue polling later

#### Scenario: Ack request fails
- **WHEN** the ack endpoint returns an error or cannot be reached after a successful screen write
- **THEN** the receiver SHALL log the ack failure and SHALL continue polling later

### Requirement: Receiver Display Restore
The local receiver SHALL conservatively release remote display occupation when the remote target ends and restore is enabled.

#### Scenario: Restore is disabled
- **WHEN** `RECEIVER_RESTORE_ON_EMPTY=false` and `/next` returns `message: null`
- **THEN** the receiver SHALL NOT call display restore

#### Scenario: Consecutive empty polls
- **WHEN** display restore has already succeeded for an ended remote target
- **THEN** later consecutive `message: null` responses SHALL NOT repeat restore writes

#### Scenario: Restore succeeds
- **WHEN** the receiver calls display restore and all configured restore writes succeed
- **THEN** it SHALL mark remote display occupation inactive

#### Scenario: Restore fails
- **WHEN** display restore throws or rejects
- **THEN** the receiver SHALL log the error and SHALL keep the polling loop alive

#### Scenario: Lyric restore is enabled
- **WHEN** display restore runs with lyric restoration enabled
- **THEN** the receiver SHALL re-enable the lyric switch but SHALL NOT attempt to preserve or replay lyric text

### Requirement: Shared Screen Writer Compatibility
The receiver and the existing screen CLI SHALL share the same K20 GT screen-writing implementation.

#### Scenario: Existing screen command is used
- **WHEN** the user runs `npm run screen -- "今天别熬夜"`
- **THEN** the command SHALL continue to send the provided text to the K20 GT using the known visible custom-text write sequence

#### Scenario: Restore helpers are used
- **WHEN** the receiver releases remote display occupation
- **THEN** it SHALL use shared screen-writer helpers for `cmd 9` screen-state restore and `cmd 11` lyric switch restore
