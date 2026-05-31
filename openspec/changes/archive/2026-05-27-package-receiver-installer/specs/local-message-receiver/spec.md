## ADDED Requirements

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
- **THEN** polling, screen writing, ack, restore, DND, dismiss, and display status behavior SHALL remain equivalent to `npm run receiver`.
