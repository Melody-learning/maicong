## MODIFIED Requirements

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
