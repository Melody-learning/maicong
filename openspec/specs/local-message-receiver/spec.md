# local-message-receiver Specification

## Purpose
Defines the first local Node.js receiver that polls the remote message API, writes scheduled messages to the connected K20 GT screen, acknowledges messages only after successful local display, and releases remote display occupation when remote targets end.
## Requirements
### Requirement: Receiver Configuration
The local receiver SHALL read its cloud API base URL, receiver token, poll interval, optional log level, optional display restore settings, and optional local display control settings from local runtime configuration.

#### Scenario: DND setting is omitted
- **WHEN** `RECEIVER_DND` is not configured
- **THEN** the receiver SHALL start with Do Not Disturb disabled.

#### Scenario: Control file setting is omitted
- **WHEN** `RECEIVER_CONTROL_FILE` is not configured
- **THEN** the receiver SHALL use `receiver-control.json` as the local one-shot control file path.

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

### Requirement: Resilient Poll Loop
The local receiver SHALL keep the polling loop alive across recoverable API, JSON, and device errors.

#### Scenario: Next request fails
- **WHEN** the next-message request fails, returns a non-success status, or returns invalid JSON
- **THEN** the receiver SHALL log the failure and SHALL continue polling later

#### Scenario: Ctrl+C is received
- **WHEN** the user sends an interrupt signal to the running receiver
- **THEN** the receiver SHALL stop scheduling new polls and exit gracefully

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

### Requirement: Receiver Status Sync
The local receiver SHALL report its local display/control state to the remote API.

#### Scenario: Loop reports status
- **WHEN** a receiver loop tick runs
- **THEN** it SHALL attempt to report `lastSeenAt`, DND state, remote display activity, and current display message id/type to `POST /api/display/status`.

#### Scenario: DND change reports status
- **WHEN** local DND is enabled or disabled
- **THEN** the receiver SHALL report the new DND state to the remote API.

#### Scenario: Active message reports status
- **WHEN** a message is written and acknowledged or the local display session changes
- **THEN** the receiver SHALL report the current remote display message id/type and active flag.

#### Scenario: Restore reports inactive status
- **WHEN** display restore succeeds and remote display occupation is cleared
- **THEN** the receiver SHALL report remote display inactive.

#### Scenario: Status update fails
- **WHEN** `POST /api/display/status` returns an error or cannot be reached
- **THEN** the receiver SHALL log the failure and keep the polling loop alive.

### Requirement: Receiver Do Not Disturb
The local receiver SHALL support a receiver-local Do Not Disturb state that blocks remote display writes without dismissing server-side messages.

#### Scenario: DND starts enabled
- **WHEN** `RECEIVER_DND=true`
- **THEN** the receiver SHALL NOT request `/api/messages/next`, write the screen, or ack any undisplayed message while DND remains enabled.

#### Scenario: DND is enabled while remote display is active
- **WHEN** a local control command enables DND and the receiver believes remote display is active
- **THEN** the receiver SHALL attempt display restore once and clear the local display session only if restore succeeds.

#### Scenario: DND is enabled while remote display is inactive
- **WHEN** a local control command enables DND and no remote display is active
- **THEN** the receiver SHALL NOT write to the screen.

#### Scenario: DND is disabled
- **WHEN** a local control command disables DND
- **THEN** the receiver SHALL resume normal polling and display behavior on later loop ticks.

#### Scenario: DND is not dismiss
- **WHEN** DND is enabled while a sticky exists on the server
- **THEN** the receiver SHALL NOT clear or dismiss that sticky solely because DND is enabled.

### Requirement: Receiver Current Message Dismiss
The local receiver SHALL be able to dismiss/read the currently displayed remote message and release remote display occupation.

#### Scenario: Current message is dismissed
- **WHEN** the receiver has a current remote message and receives a local dismiss command
- **THEN** it SHALL call `POST /api/messages/{id}/dismiss` with the receiver bearer token, attempt display restore, and clear the local display session after successful restore.

#### Scenario: Dismiss is requested without current message
- **WHEN** the receiver receives a local dismiss command but has no current remote message
- **THEN** it SHALL NOT call the dismiss endpoint and SHALL NOT write the screen.

#### Scenario: Dismiss request fails
- **WHEN** the dismiss endpoint returns an error or cannot be reached
- **THEN** the receiver SHALL log the failure, keep the loop alive, and keep the current display session available for retry.

#### Scenario: Dismiss restore fails
- **WHEN** dismissing the server message succeeds but display restore throws or rejects
- **THEN** the receiver SHALL log the restore failure, keep the loop alive, and avoid clearing the local display session as successfully restored.

### Requirement: Receiver Local Control File
The local receiver SHALL support a minimal local JSON control file for one-shot display control commands.

#### Scenario: Dismiss command file is present
- **WHEN** the configured control file contains `{ "command": "dismiss" }`
- **THEN** the receiver SHALL process it as a current-message dismiss command before polling for the next message.

#### Scenario: DND command file is present
- **WHEN** the configured control file enables or disables DND
- **THEN** the receiver SHALL update local DND state before polling for the next message.

#### Scenario: Valid command file is processed
- **WHEN** a valid control file command has been applied
- **THEN** the receiver SHALL remove the control file so the command is not repeated on every poll.

#### Scenario: Invalid command file is present
- **WHEN** the configured control file contains invalid JSON or an unknown command
- **THEN** the receiver SHALL log the problem, keep the loop alive, and leave the file in place for correction.

### Requirement: Local Takeover Detection Boundary
The receiver display controls SHALL provide manual dismiss/DND foundations without relying on automatic HID local-takeover detection in the first version.

#### Scenario: Automatic local takeover detection is unavailable
- **WHEN** the local user changes K20 GT display through MCHOSE HUB
- **THEN** this version SHALL require an explicit local dismiss/read control to prevent the current remote message from being rewritten, and documentation SHALL identify automatic detection as future work.
