## ADDED Requirements

### Requirement: Local Receiver Config File
The system SHALL support a local `receiver.config.json` file for receiver runtime configuration without requiring every receiver option to be supplied through environment variables.

#### Scenario: Config file is present
- **WHEN** `receiver.config.json` contains supported receiver settings
- **THEN** receiver startup SHALL merge those settings into runtime config before applying environment-variable overrides.

#### Scenario: Config file is missing
- **WHEN** `receiver.config.json` does not exist
- **THEN** receiver startup SHALL continue using environment variables and defaults.

#### Scenario: Environment overrides config file
- **WHEN** the same receiver setting is provided by both `receiver.config.json` and an environment variable
- **THEN** the environment-variable value SHALL take precedence.

#### Scenario: Config JSON is invalid
- **WHEN** the configured receiver config file contains malformed JSON
- **THEN** the receiver SHALL fail with a clear configuration error instead of silently ignoring the file.

#### Scenario: Local config contains secrets
- **WHEN** a user creates `receiver.config.json`
- **THEN** the repository SHALL ignore that file and provide a token-free or placeholder `receiver.config.example.json` template.

### Requirement: Local Receiver Control CLI
The system SHALL provide a local CLI and npm scripts for common receiver controls without requiring users to hand-write the receiver control JSON file.

#### Scenario: DND is enabled from CLI
- **WHEN** the user runs the DND-on npm script
- **THEN** the CLI SHALL write a one-shot control file command equivalent to enabling receiver-local DND.

#### Scenario: DND is disabled from CLI
- **WHEN** the user runs the DND-off npm script
- **THEN** the CLI SHALL write a one-shot control file command equivalent to disabling receiver-local DND.

#### Scenario: Current message is dismissed from CLI
- **WHEN** the user runs the dismiss npm script
- **THEN** the CLI SHALL write a one-shot control file command equivalent to dismissing the current remote message.

#### Scenario: Local display restore is requested from CLI
- **WHEN** the user runs the restore npm script
- **THEN** the CLI SHALL write a one-shot control file command requesting receiver display restore.

#### Scenario: Status is requested from CLI
- **WHEN** the user runs the status npm script with local status credentials configured
- **THEN** the CLI SHALL call `GET /api/display/status` with the sender bearer token and print receiver online, DND, current display, sticky, and pending transient summary.

#### Scenario: Status token is missing
- **WHEN** the user runs the status npm script without a configured sender token
- **THEN** the CLI SHALL fail with a clear configuration error and SHALL NOT use the receiver token as a substitute.
