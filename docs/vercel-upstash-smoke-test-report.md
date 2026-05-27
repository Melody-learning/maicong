# Vercel + Upstash Smoke Test Report

Date: 2026-05-27

## Summary

The first online remote message relay path was verified end to end:

```text
GitHub repository
  -> Vercel Serverless API
  -> Upstash Redis
  -> local receiver
  -> MCHOSE K20 GT screen
```

Production deployment URL:

```text
https://maicong-ln98hobfm-melody-learnings-projects.vercel.app
```

GitHub repository:

```text
https://github.com/Melody-learning/maicong.git
```

## Vercel Project

- Repository imported from GitHub: `Melody-learning/maicong`
- Branch: `main`
- Application preset: `Other`
- Root directory: `./`
- Build/output settings: no custom settings required
- Initial root page returning `404 NOT_FOUND` is expected because this project currently exposes API routes only.

## Upstash Redis

Upstash for Redis was created and connected through Vercel Storage.

The integration automatically created Vercel KV-compatible environment variables:

```text
KV_REST_API_URL
KV_REST_API_TOKEN
KV_REST_API_READ_ONLY_TOKEN
KV_URL
REDIS_URL
```

The API code supports `KV_REST_API_URL` and `KV_REST_API_TOKEN`, so no duplicate `UPSTASH_REDIS_REST_URL` or `UPSTASH_REDIS_REST_TOKEN` variables were required.

## Environment Variables

Required application variables were added manually in Vercel:

```text
SEND_TOKEN
RECEIVER_TOKEN
```

Both were configured as sensitive variables for Production and Preview.

Security note: real token values were not recorded in this report and should not be committed.

## Deployment Protection

Vercel Authentication was initially enabled and blocked direct API smoke tests with an authentication page.

Resolution:

- Project Settings -> Deployment Protection
- Disabled `Vercel Authentication` / `Require Log In`

This is acceptable for the first version because the API has its own bearer-token authorization:

- `SEND_TOKEN` protects message creation and sticky clear.
- `RECEIVER_TOKEN` protects receiver polling and ack.

## Smoke Test Results

PowerShell `curl.exe` had JSON quoting issues, so smoke tests were completed with `Invoke-RestMethod`.

### Create Sticky

Endpoint:

```text
POST /api/messages
```

Payload:

```json
{"type":"sticky","text":"今天别熬夜"}
```

Result:

- Success
- Returned a `sticky` message with status `pending`

### Create Transient

Endpoint:

```text
POST /api/messages
```

Payload:

```json
{"type":"transient","text":"喝水","ttlSeconds":300,"displaySeconds":20}
```

Result:

- Success
- Returned a `transient` message with status `pending`

### Pull Next

Endpoint:

```text
GET /api/messages/next
```

Result:

- Success
- Returned the transient message `喝水`
- Message status changed to `showing`

### Ack

Endpoint:

```text
POST /api/messages/{id}/ack
```

Result:

- Success
- Returned `acknowledged: true`
- Message status changed to `shown`

### Clear Sticky

Endpoint:

```text
POST /api/messages/clear
```

Result:

- Success
- Returned `cleared: true`
- Sticky message status changed to `expired`

## Local Receiver Verification

The local receiver was pointed at the production Vercel API:

```text
REMOTE_MESSAGE_API_BASE_URL=https://maicong-ln98hobfm-melody-learnings-projects.vercel.app
RECEIVER_TOKEN=<configured locally only>
RECEIVER_POLL_INTERVAL_MS=3000
```

Command:

```powershell
npm run receiver
```

Result:

- Receiver connected to the online API.
- A remote transient message was pulled successfully.
- The message was displayed on the connected `MCHOSE K20 GT` screen.
- This confirms the first real online-to-device display loop.

## Confirmed Facts

- Vercel deployment works for the API-only project.
- No custom Vercel build or output configuration is required.
- Upstash Redis integration works through Vercel KV-compatible environment variables.
- Deployment Protection must not block API clients unless a bypass strategy is added.
- The online API token model works as intended.
- The local receiver can use the online API and write to the real K20 GT screen.

## Follow-Up Items

- Observe receiver stability from the actual long-term device/network environment.
- Decide whether to keep Vercel Authentication disabled or add a documented bypass flow for automation.
- Minimal web sender UI for `sticky` and `transient` messages has been implemented and locally verified; see `docs/web-message-sender-smoke-test-report.md`.
- Package the receiver experience with pause/do-not-disturb, startup, and tray controls.
- Continue long-text and display-layer probing separately from the deployment path.
