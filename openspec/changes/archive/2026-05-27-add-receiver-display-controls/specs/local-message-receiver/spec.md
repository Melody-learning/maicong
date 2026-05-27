## MODIFIED Requirements

### Requirement: Receiver Configuration
The local receiver SHALL read its cloud API base URL, receiver token, poll interval, optional log level, optional display restore settings, and optional local display control settings from local runtime configuration.

#### Scenario: DND setting is omitted
- **WHEN** `RECEIVER_DND` is not configured
- **THEN** the receiver SHALL start with Do Not Disturb disabled.

#### Scenario: Control file setting is omitted
- **WHEN** `RECEIVER_CONTROL_FILE` is not configured
- **THEN** the receiver SHALL use `receiver-control.json` as the local one-shot control file path.

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

## ADDED Requirements

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
