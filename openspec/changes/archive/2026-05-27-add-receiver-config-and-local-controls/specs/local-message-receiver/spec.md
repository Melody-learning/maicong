## MODIFIED Requirements

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
