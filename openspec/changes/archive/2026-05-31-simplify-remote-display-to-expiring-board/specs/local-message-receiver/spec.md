## ADDED Requirements

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Poll Next Message
**Reason**: The receiver no longer consumes a sticky/transient message scheduler.
**Migration**: Poll `GET /api/board` and apply current-board display rules.

### Requirement: Acknowledge After Screen Write
**Reason**: Message acknowledgement is replaced by board displayed reporting.
**Migration**: Use `POST /api/board/{id}/displayed` after a successful screen write.

### Requirement: Receiver Current Message Dismiss
**Reason**: Current-message dismiss is replaced by current-board dismiss.
**Migration**: Use `POST /api/board/{id}/dismiss` for the active displayed board.
