## ADDED Requirements

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
