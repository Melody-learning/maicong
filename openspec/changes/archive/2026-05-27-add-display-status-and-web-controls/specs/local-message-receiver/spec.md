## MODIFIED Requirements

### Requirement: Receiver Configuration
The local receiver SHALL read its cloud API base URL, receiver token, poll interval, optional log level, optional display restore settings, optional local display control settings, and optional receiver status sync settings from local runtime configuration.

#### Scenario: Receiver status TTL is omitted
- **WHEN** `RECEIVER_STATUS_TTL_SECONDS` is not configured
- **THEN** the receiver SHALL use a default status TTL of about 30 seconds.

#### Scenario: Receiver status update interval is omitted
- **WHEN** `RECEIVER_STATUS_UPDATE_INTERVAL_MS` is not configured
- **THEN** the receiver MAY report status each loop without an additional throttle.

## ADDED Requirements

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

#### Scenario: DND remains locally authoritative
- **WHEN** web/API sender status is displayed
- **THEN** the receiver's local DND state remains the source of truth and is not changed by sender-token web controls.
