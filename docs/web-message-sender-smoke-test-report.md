# Web Message Sender Smoke Test Report

Date: 2026-05-28

## Summary

The first minimal browser sender was verified through the local-to-device path:

```text
Browser at http://localhost:3000/
  -> local Vercel API
  -> Upstash Redis
  -> local receiver
  -> MCHOSE K20 GT screen
```

The user also manually tested the web page and confirmed it works.

After commit `4f41054` was pushed to `main`, Vercel deployed the production web sender. The user tested the production root page and confirmed it also works.

Production deployment tested:

```text
https://maicong-gxbcjko4c-melody-learnings-projects.vercel.app/
```

## Environment

- Local Vercel CLI login completed for `melody-learning`.
- Local Vercel project linked to `melody-learnings-projects/maicong`.
- Local development server started with `npm run vercel:dev`.
- Local receiver was pointed at `http://localhost:3000`.
- Real token and Upstash values were kept in local `.env` and were not recorded in this report.

Required local values:

```text
SEND_TOKEN
RECEIVER_TOKEN
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

The current API also supports the Vercel KV-compatible names:

```text
KV_REST_API_URL
KV_REST_API_TOKEN
```

## Notes From Setup

`vercel env pull` showed the expected variable names, but the pulled sensitive values were empty locally. The working local test used the real values from `.env`.

An old receiver process was still running during early testing and consumed a queued message before the visible receiver window printed it. After stopping duplicate receiver processes and starting one clean receiver, the visible logs matched the expected flow.

Vercel local development provided the JSON payload as `req.body`, while the API originally only read the request stream. `lib/remote-message/api.js` now accepts both pre-parsed `req.body` and stream bodies so local Vercel dev and deployed serverless behavior are both supported.

The local npm script is named `vercel:dev` instead of `dev` because Vercel CLI treats a package `dev` script that invokes `vercel dev` as a recursive project development command and rejects it.

## Verification Steps

### Local API and Redis

`GET /api/messages/next` with `RECEIVER_TOKEN` returned:

```json
{"message":null}
```

This confirmed that the local API could authenticate and reach Redis without using placeholder Upstash values.

### Direct HID Write

Command:

```powershell
npm run screen -- "本地直写测试"
```

Result:

```text
Sent 64 bytes to MCHOSE K20 GT: 本地直写测试
```

This confirmed the local HID endpoint still worked.

### Receiver End-to-End

A transient message was created against the local API:

```json
{"type":"transient","text":"干净receiver测试","displaySeconds":20}
```

Receiver result:

```text
[receiver] received transient message ...: 干净receiver测试
[receiver] wrote message ... to K20 GT screen
[receiver] acked message ...
```

This confirms local sender/API/storage/receiver/HID behavior works end to end.

### Web Page Manual Test

The page opened at:

```text
http://localhost:3000/
```

Confirmed behavior:

- Page loads as the sender tool with title `发一条小纸条`.
- User can enter `SEND_TOKEN`.
- User can send through the browser UI.
- User confirmed the manual web test works.

### Production Web Page Test

After GitHub push and Vercel production deployment, the production root page was opened and tested by the user.

Confirmed behavior:

- Production root path serves the sender tool.
- User can send through the production browser UI.
- User confirmed the production web test works.

## Confirmed Facts

- The first web sender UI is usable locally.
- The page must use `SEND_TOKEN`; it does not need or ask for `RECEIVER_TOKEN`.
- Local Vercel dev requires real Redis and token values in local environment configuration.
- Duplicate receiver processes can consume messages invisibly; use one receiver during manual verification.
- The local-to-device path is now verified for the web sender.
- The production root page is now verified for the web sender.

## Follow-Up Items

- Continue `probe-long-text-display` separately; this report does not change long-text, scrolling, lyric-layer, or image-protocol conclusions.
- Package receiver experience later with tray, pause/do-not-disturb, startup, and configuration UX.
