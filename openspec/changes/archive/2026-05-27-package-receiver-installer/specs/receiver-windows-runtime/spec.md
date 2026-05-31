## ADDED Requirements

### Requirement: Windows Runtime Scripts
The system SHALL provide Windows script-level receiver runtime commands for installation checks, background start, stop, status, and login autostart management.

#### Scenario: Install check succeeds
- **WHEN** the user runs the Windows install/check script with a valid `receiver.config.json`
- **THEN** the script SHALL verify local prerequisites and configuration without printing configured tokens.

#### Scenario: Config file is missing
- **WHEN** the user runs the Windows install/check script and `receiver.config.json` is absent
- **THEN** the script SHALL fail with a clear message that points to `receiver.config.example.json`.

#### Scenario: Background receiver starts
- **WHEN** the user runs the Windows start script and no project-managed receiver is running
- **THEN** the script SHALL start the receiver as a background process, write local PID metadata, and redirect output to an ignored local log file.

#### Scenario: Duplicate start is requested
- **WHEN** the user runs the Windows start script while the PID metadata points to a live project-managed receiver
- **THEN** the script SHALL report that the receiver is already running and SHALL NOT start a second receiver process.

#### Scenario: Receiver stops
- **WHEN** the user runs the Windows stop script and the PID metadata points to a live project-managed receiver
- **THEN** the script SHALL stop that process and remove the PID metadata.

#### Scenario: Stale PID metadata exists
- **WHEN** the user runs status, start, or stop and the PID metadata points to no live project-managed receiver
- **THEN** the script SHALL treat the metadata as stale and avoid stopping unrelated Node processes.

#### Scenario: Status is requested
- **WHEN** the user runs the Windows status script
- **THEN** the script SHALL show local runtime state and may also call the existing receiver status CLI when sender status credentials are configured.

### Requirement: Windows Login Autostart
The system SHALL allow the user to enable or disable per-user login autostart for the receiver without requiring administrator privileges.

#### Scenario: Autostart is enabled
- **WHEN** the user runs the autostart-on script
- **THEN** the system SHALL register or update a per-user Windows Task Scheduler task that starts the receiver through the project start script at user logon.

#### Scenario: Autostart is disabled
- **WHEN** the user runs the autostart-off script
- **THEN** the system SHALL remove the project receiver autostart task if it exists.

#### Scenario: Autostart scripts are previewed
- **WHEN** the user runs autostart scripts in dry-run or WhatIf mode
- **THEN** the scripts SHALL show the intended Task Scheduler operation without registering or removing the task.

### Requirement: Windows Runtime NPM Scripts
The system SHALL provide npm scripts for the Windows receiver runtime commands.

#### Scenario: NPM start script is used
- **WHEN** the user runs `npm run receiver:start` on Windows
- **THEN** npm SHALL invoke the Windows start script.

#### Scenario: NPM stop script is used
- **WHEN** the user runs `npm run receiver:stop` on Windows
- **THEN** npm SHALL invoke the Windows stop script.

#### Scenario: NPM autostart scripts are used
- **WHEN** the user runs the receiver autostart npm scripts on Windows
- **THEN** npm SHALL invoke the corresponding Windows Task Scheduler wrapper scripts.
