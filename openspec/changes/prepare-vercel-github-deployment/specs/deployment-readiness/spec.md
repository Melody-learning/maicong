## ADDED Requirements

### Requirement: Repository Ignore Rules
The repository SHALL ignore generated dependencies, local secret files, deployment metadata, temporary extraction directories, logs, caches, and common operating-system files before GitHub publication.

#### Scenario: Secret and generated files are excluded
- **WHEN** the repository is prepared for a GitHub commit
- **THEN** `node_modules/`, `.env`, secret-bearing `.env.*` files, `.vercel/`, `.tmp-mchose-asar/`, logs, caches, and system files are covered by ignore rules

### Requirement: Placeholder Environment Example
The repository SHALL provide an `.env.example` that lists required and optional cloud API and local receiver variables using placeholders only.

#### Scenario: Environment template contains no real secrets
- **WHEN** a deployer opens `.env.example`
- **THEN** it includes placeholders for `SEND_TOKEN`, `RECEIVER_TOKEN`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, API tuning variables, `REMOTE_MESSAGE_API_BASE_URL`, and `RECEIVER_POLL_INTERVAL_MS` without real secret values

### Requirement: Manual Deployment Guide
The repository SHALL document the manual process for publishing the project to GitHub and connecting it to Vercel with Upstash Redis.

#### Scenario: Deployer follows GitHub and Vercel setup
- **WHEN** a deployer reads the deployment guide
- **THEN** it explains how to commit to `Melody-learning/maicong.git`, create a Vercel project from that repository, connect or create Upstash Redis, and configure required Vercel environment variables

### Requirement: Online Smoke Test Instructions
The deployment guide SHALL include copyable smoke-test commands for the deployed API and local receiver.

#### Scenario: Deployer verifies deployed API and receiver
- **WHEN** Vercel deployment has completed
- **THEN** the guide provides commands to create sticky and transient messages, pull the next message, acknowledge a message, clear sticky state, set `REMOTE_MESSAGE_API_BASE_URL`, and run `npm run receiver`

### Requirement: Deployment Safety Notes
The deployment documentation SHALL state security and operational caveats for first field validation.

#### Scenario: Deployer reviews safety guidance
- **WHEN** a deployer reads the deployment guide
- **THEN** it states not to commit real tokens, to use different sender and receiver tokens, to keep the receiver token out of frontend code, and to treat Vercel plus Upstash domestic network stability as unverified until field testing
