# receiver-windows-runtime Specification

## Purpose
Defines the first Windows script-level runtime for operating the local K20 GT receiver without a developer foreground terminal, including config checks, background start/stop, PID tracking, logs, status, and per-user Task Scheduler autostart.
## Requirements
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

### Requirement: Private Preconfigured Receiver Bundle
The system SHALL provide a developer-run command that prepares a private Windows receiver bundle in an ignored distribution directory, defaulting to production-oriented bundle configuration sources and refusing accidental local-only API URLs.

#### Scenario: Bundle is generated from deployment environment values
- **WHEN** the developer runs the bundle preparation command without an explicit config source and local `.env` or process environment values provide `REMOTE_MESSAGE_API_BASE_URL`, `RECEIVER_TOKEN`, and optional `SEND_TOKEN`
- **THEN** the generated bundle SHALL write those values into the ignored bundle output `receiver.config.json` and SHALL NOT copy the developer's current-machine `receiver.config.json` by default.

#### Scenario: Local env overrides are excluded from production bundle by default
- **WHEN** `.env.local` contains local development credentials and the developer runs the default bundle preparation command
- **THEN** `.env.local` values SHALL NOT override production bundle config input.

#### Scenario: Local env overrides are explicitly included for local testing
- **WHEN** the developer explicitly includes local env overrides while preparing a local test bundle
- **THEN** `.env.local` values MAY override `.env` values for that bundle generation.

#### Scenario: Bundle is generated from explicit bundle environment values
- **WHEN** the developer runs the bundle preparation command with `BUNDLE_API_BASE_URL`, `BUNDLE_RECEIVER_TOKEN`, and optional `BUNDLE_SEND_TOKEN`
- **THEN** those values SHALL take precedence over generic development environment values for the generated bundle config.

#### Scenario: Bundle is generated from explicit local config source
- **WHEN** the developer runs the bundle preparation command with an explicit ignored config source file
- **THEN** the generated bundle SHALL contain a copied `receiver.config.json` from that source and SHALL NOT require the target user to type `apiBaseUrl`, `receiverToken`, or `sendToken`.

#### Scenario: Bundle config is generated from command arguments
- **WHEN** the developer runs the bundle preparation command with explicit command arguments for `apiBaseUrl`, `receiverToken`, and optional `sendToken`
- **THEN** the generated bundle SHALL write those values only into the ignored bundle output `receiver.config.json`.

#### Scenario: Localhost bundle is rejected by default
- **WHEN** the bundle preparation command would generate a bundle config whose `apiBaseUrl` is localhost, loopback, or an unspecified local address
- **THEN** the command SHALL fail with a clear message before writing a private receiver package unless local bundle output was explicitly allowed.

#### Scenario: Localhost bundle is explicitly allowed
- **WHEN** the developer explicitly allows local bundle output for testing
- **THEN** the bundle preparation command MAY generate a bundle whose `apiBaseUrl` is localhost or loopback.

#### Scenario: Private output is isolated from git
- **WHEN** a bundle is generated at the default output location
- **THEN** the output SHALL be under a git-ignored distribution directory.

#### Scenario: Bundle excludes local runtime state
- **WHEN** a bundle is generated from the developer checkout
- **THEN** the bundle SHALL exclude local runtime state such as logs, PID metadata, `node_modules`, existing `dist` output, and repository metadata.

### Requirement: Bundle Command Wrappers
The system SHALL generate double-clickable Windows command wrappers for daily receiver operations.

#### Scenario: Install wrapper is used
- **WHEN** the target user runs `install.cmd` from the generated bundle
- **THEN** the wrapper SHALL run dependency/config checks for that bundle without printing token values.

#### Scenario: Start wrapper is used
- **WHEN** the target user runs `start.cmd` from the generated bundle
- **THEN** the wrapper SHALL start the receiver through the existing Windows runtime so duplicate-process PID checks are preserved.

#### Scenario: Stop and status wrappers are used
- **WHEN** the target user runs `stop.cmd` or `status.cmd` from the generated bundle
- **THEN** the wrapper SHALL call the existing runtime/control commands for that bundle and SHALL NOT expose token values.

#### Scenario: Autostart wrappers are used
- **WHEN** the target user runs `autostart-on.cmd` or `autostart-off.cmd` from the generated bundle
- **THEN** the wrapper SHALL use the existing Task Scheduler runtime commands for that bundle.

#### Scenario: Local control wrappers are used
- **WHEN** the target user runs `dnd-on.cmd`, `dnd-off.cmd`, `dismiss.cmd`, or `restore.cmd` from the generated bundle
- **THEN** the wrapper SHALL call the existing local receiver control CLI for that bundle.

### Requirement: Bundle Secret Handling
The system SHALL keep private bundle credentials separated, local, and redacted from human-readable command output.

#### Scenario: Receiver token and sender token are configured
- **WHEN** the bundle config includes both `receiverToken` and `sendToken`
- **THEN** generated scripts SHALL preserve them as separate config fields and SHALL NOT use `receiverToken` as a substitute sender token.

#### Scenario: Bundle generation reports config summary
- **WHEN** the bundle preparation command prints a result summary
- **THEN** it SHALL report token presence only and SHALL NOT print token values.

#### Scenario: Generated documentation is read
- **WHEN** the target user opens the generated bundle README
- **THEN** it SHALL identify the bundle as private, warn against public upload, and describe the command wrappers without including real token values.
