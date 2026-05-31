# local-message-receiver Specification

## Purpose
Defines the first local Node.js receiver that polls the remote message API, writes scheduled messages to the connected K20 GT screen, acknowledges messages only after successful local display, and releases remote display occupation when remote targets end.
## Requirements
### Requirement: Receiver Configuration
The local receiver SHALL read its cloud API base URL, receiver token, poll interval, optional log level, optional display restore settings, optional local display control settings, optional receiver status sync settings, and optional local config-file values from local runtime configuration.

#### Scenario: Config file values are used
- **WHEN** a supported setting is present in `receiver.config.json` and not overridden by environment variables
- **THEN** the receiver SHALL use the config-file value.

#### Scenario: Environment overrides config file
- **WHEN** a supported setting is present in both the environment and `receiver.config.json`
- **THEN** the receiver SHALL use the environment value.

#### Scenario: Config file is omitted
- **WHEN** no receiver config file exists
- **THEN** the receiver SHALL use environment values and defaults without crashing.

#### Scenario: Config file is malformed
- **WHEN** the configured receiver config file is not valid JSON
- **THEN** receiver startup SHALL report a configuration error.

#### Scenario: Required receiver credentials are missing
- **WHEN** the merged receiver configuration lacks the API base URL or receiver token
- **THEN** the receiver SHALL fail with a clear configuration error.

#### Scenario: DND setting is omitted
- **WHEN** DND is not configured by environment variable or config file
- **THEN** the receiver SHALL start with Do Not Disturb disabled.

#### Scenario: Control file setting is omitted
- **WHEN** the control file is not configured by environment variable or config file
- **THEN** the receiver SHALL use `receiver-control.json` as the local one-shot control file path.

#### Scenario: Receiver status TTL is omitted
- **WHEN** receiver status TTL is not configured by environment variable or config file
- **THEN** the receiver SHALL use a default status TTL of about 30 seconds.

#### Scenario: Receiver status update interval is omitted
- **WHEN** receiver status update interval is not configured by environment variable or config file
- **THEN** the receiver MAY report status each loop without an additional throttle.

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
- **THEN** it SHALL attempt to report `lastSeenAt`, DND state, remote display activity, and current display board id to `POST /api/display/status`.

#### Scenario: DND change reports status
- **WHEN** local DND is enabled or disabled
- **THEN** the receiver SHALL report the new DND state to the remote API.

#### Scenario: Active board reports status
- **WHEN** a board is written and reported displayed or the local display session changes
- **THEN** the receiver SHALL report the current remote display board id and active flag.

#### Scenario: Restore reports inactive status
- **WHEN** display restore succeeds and remote display occupation is cleared
- **THEN** the receiver SHALL report remote display inactive.

#### Scenario: Status update fails
- **WHEN** `POST /api/display/status` returns an error or cannot be reached
- **THEN** the receiver SHALL log the failure and keep the polling loop alive.

### Requirement: Receiver Do Not Disturb
The local receiver SHALL support a receiver-local Do Not Disturb state that blocks remote display writes without clearing server-side board state.

#### Scenario: DND starts enabled
- **WHEN** `RECEIVER_DND=true`
- **THEN** the receiver SHALL NOT request the current board, write the screen, or report an undisplayed board while DND remains enabled.

#### Scenario: DND is enabled while remote display is active
- **WHEN** a local control command enables DND and the receiver believes remote display is active
- **THEN** the receiver SHALL attempt display restore once and clear the local display session only if restore succeeds.

#### Scenario: DND is enabled while remote display is inactive
- **WHEN** a local control command enables DND and no remote display is active
- **THEN** the receiver SHALL NOT write to the screen.

#### Scenario: DND is disabled
- **WHEN** a local control command disables DND
- **THEN** the receiver SHALL resume normal polling and board display behavior on later loop ticks.

#### Scenario: DND is not dismiss
- **WHEN** DND is enabled while a board exists on the server
- **THEN** the receiver SHALL NOT clear or dismiss that board solely because DND is enabled.

### Requirement: Receiver Local Control File
The local receiver SHALL support a minimal local JSON control file for one-shot display control commands.

#### Scenario: Dismiss command file is present
- **WHEN** the configured control file contains `{ "command": "dismiss" }`
- **THEN** the receiver SHALL process it as a current-message dismiss command before polling for the next message.

#### Scenario: DND command file is present
- **WHEN** the configured control file enables or disables DND
- **THEN** the receiver SHALL update local DND state before polling for the next message.

#### Scenario: Restore command file is present
- **WHEN** the configured control file contains `{ "command": "restore" }`
- **THEN** the receiver SHALL attempt configured display restore before polling for the next message.

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

### Requirement: Packaged Runtime Compatibility
The local receiver SHALL remain compatible with a project-managed background runtime that performs config checks, log redirection, and process lifecycle management outside the receiver loop.

#### Scenario: Config is checked before background start
- **WHEN** the Windows runtime checks receiver configuration before start
- **THEN** it SHALL reuse receiver config parsing semantics and require the same API base URL and receiver token needed by normal receiver startup.

#### Scenario: Background logging is enabled
- **WHEN** the receiver is started by the Windows runtime
- **THEN** receiver stdout and stderr SHALL be redirected to ignored local log files or an ignored local log path.

#### Scenario: Existing receiver behavior is preserved
- **WHEN** the receiver is started through the Windows runtime
- **THEN** board polling, screen writing, displayed reporting, restore, DND, dismiss, and display status behavior SHALL remain equivalent to `npm run receiver`.

### Requirement: Poll Current Board
The local receiver SHALL poll the board API for the current unexpired board and SHALL treat a missing board as the end of remote display occupation.

#### Scenario: No board is available with no remote display occupation
- **WHEN** the API returns a successful response with `board: null` and the receiver has no active remote display occupation
- **THEN** the receiver SHALL NOT write to the K20 GT screen and SHALL continue polling later.

#### Scenario: No board is available after remote display occupation
- **WHEN** the API returns a successful response with `board: null` and the receiver believes remote display is active
- **THEN** the receiver SHALL attempt the configured display restore once before continuing to poll.

#### Scenario: New board is available
- **WHEN** the API returns a current board whose id is not the receiver's active displayed board id
- **THEN** the receiver SHALL attempt to write the board text to the K20 GT screen.

#### Scenario: Same board remains current
- **WHEN** the API returns the same board id that the receiver has already displayed and still tracks as active
- **THEN** the receiver SHALL NOT rewrite the screen text or send another displayed report solely because the poll repeated.

### Requirement: Report Board Displayed After Screen Write
The local receiver SHALL report a board as displayed only after the local screen write succeeds.

#### Scenario: Screen write succeeds
- **WHEN** the receiver writes a new board to the K20 GT screen without error
- **THEN** it SHALL call `POST /api/board/{id}/displayed` with the receiver bearer token.

#### Scenario: Screen write fails
- **WHEN** writing a returned board to the K20 GT screen throws or rejects
- **THEN** the receiver SHALL NOT call the displayed endpoint for that board, SHALL NOT run display restore for that failed write, and SHALL continue polling later.

#### Scenario: Displayed request fails
- **WHEN** the displayed endpoint returns an error or cannot be reached after a successful screen write
- **THEN** the receiver SHALL log the failure, keep the local display session active for the written board, and continue polling later.

### Requirement: Receiver Current Board Dismiss
The local receiver SHALL be able to dismiss the currently displayed board and release remote display occupation.

#### Scenario: Current board is dismissed
- **WHEN** the receiver has a current board and receives a local dismiss command
- **THEN** it SHALL call `POST /api/board/{id}/dismiss` with the receiver bearer token, attempt display restore, and clear the local display session after successful restore.

#### Scenario: Dismiss is requested without current board
- **WHEN** the receiver receives a local dismiss command but has no current board
- **THEN** it SHALL NOT call the dismiss endpoint and SHALL NOT write the screen.

#### Scenario: Dismiss request fails
- **WHEN** the dismiss endpoint returns an error or cannot be reached
- **THEN** the receiver SHALL log the failure, keep the loop alive, and keep the current display session available for retry.

#### Scenario: Dismiss restore fails
- **WHEN** dismissing the server board succeeds but display restore throws or rejects
- **THEN** the receiver SHALL log the restore failure, keep the loop alive, and avoid clearing the local display session as successfully restored.

### Requirement: Local Development Configuration Separation
The local receiver SHALL keep current-machine runtime configuration separate from private bundle delivery configuration.

#### Scenario: Receiver config remains current-machine scoped
- **WHEN** `receiver.config.json` exists in the developer checkout and the local receiver is started
- **THEN** the receiver SHALL continue treating that file as the current machine's runtime config unless environment variables override it.

#### Scenario: Env files support local development
- **WHEN** no receiver config file exists and `.env` / `.env.local` provide receiver credentials
- **THEN** the receiver SHALL use those env-file values for local development without requiring the user to export tokens in every shell session.

#### Scenario: Local dev tokens are separate from production
- **WHEN** local development env overrides are configured
- **THEN** `.env.local` SHALL be able to provide a distinct `SEND_TOKEN`, `RECEIVER_TOKEN`, local API base URL, and non-production Redis key prefix for local testing.

#### Scenario: Env files default to local dev API
- **WHEN** `.env` / `.env.local` provide receiver credentials but no API base URL and no receiver config file overrides it
- **THEN** the receiver SHALL default to the local Vercel development API base URL.

#### Scenario: Delivery bundles do not depend on current-machine config
- **WHEN** the developer prepares a private receiver bundle using the default bundle command
- **THEN** the generated delivery config SHALL be selected by bundle-generation rules rather than by the local receiver runtime's current-machine config precedence.
