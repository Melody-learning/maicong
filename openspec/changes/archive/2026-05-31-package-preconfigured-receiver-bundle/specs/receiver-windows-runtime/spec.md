## ADDED Requirements

### Requirement: Private Preconfigured Receiver Bundle
The system SHALL provide a developer-run command that prepares a private Windows receiver bundle in an ignored distribution directory.

#### Scenario: Bundle is generated from existing local config
- **WHEN** the developer runs the bundle preparation command with an existing ignored `receiver.config.json` as the config source
- **THEN** the generated bundle SHALL contain a copied `receiver.config.json` and SHALL NOT require the target user to type `apiBaseUrl`, `receiverToken`, or `sendToken`.

#### Scenario: Bundle config is generated from local input
- **WHEN** the developer runs the bundle preparation command with explicit local environment values or arguments for `apiBaseUrl`, `receiverToken`, and optional `sendToken`
- **THEN** the generated bundle SHALL write those values only into the ignored bundle output `receiver.config.json`.

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
