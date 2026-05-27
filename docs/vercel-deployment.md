# Vercel Deployment Guide

This guide prepares the current project for manual GitHub + Vercel + Upstash Redis deployment. Do not commit real tokens or Redis credentials.

Target GitHub repository:

```text
Melody-learning/maicong.git
```

This guide does not require any code change to the local receiver. The root path now serves the first minimal browser sender UI after deployment.

## Safety Rules

- Do not commit real `SEND_TOKEN`, `RECEIVER_TOKEN`, Redis URLs, or Redis tokens to GitHub.
- Use different random values for `SEND_TOKEN` and `RECEIVER_TOKEN`.
- Keep `RECEIVER_TOKEN` only in Vercel environment variables and on the trusted receiver computer. Do not put it in browser frontend code.
- Treat Vercel + Upstash Redis domestic network stability as unverified until real field validation.
- The receiver computer should keep pulling from the cloud API. Do not expose a public port on her computer.

## 1. Prepare Local Git Commit

Review files before committing:

```powershell
git status
git diff -- .gitignore .env.example docs/vercel-deployment.md
```

Commit locally:

```powershell
git add .gitignore .env.example docs/vercel-deployment.md docs/remote-message-api.md docs/local-message-receiver.md package.json package-lock.json api lib tests openspec AGENTS.md K20GT_RESEARCH.md k20gt-screen.js k20gt-receiver.js k20gt-probe.js
git commit -m "Prepare Vercel GitHub deployment"
```

Connect the remote if it is not already configured:

```powershell
git remote add origin https://github.com/Melody-learning/maicong.git
```

Push manually when ready:

```powershell
git push -u origin main
```

If the local branch is named `master`, either push that branch or rename it before pushing:

```powershell
git branch -M main
```

## 2. Create Vercel Project

1. Open Vercel and create a new project.
2. Import the GitHub repository `Melody-learning/maicong`.
3. Keep the framework preset as "Other" if Vercel does not auto-detect one.
4. Leave build settings empty unless Vercel asks for them. The API lives under `api/` and does not need a frontend build.
5. Add environment variables before the first production deploy.

`package.json` already includes:

```json
{
  "scripts": {
    "vercel:dev": "vercel dev",
    "test": "vitest run"
  }
}
```

Run local Vercel development with `npm run vercel:dev`.

## 3. Create or Connect Upstash Redis

Use either the Vercel Marketplace Upstash integration or an existing Upstash Redis database.

Required Redis values:

- REST URL
- REST token

The API accepts either Upstash names or Vercel KV-compatible names:

- `UPSTASH_REDIS_REST_URL` or `KV_REST_API_URL`
- `UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_TOKEN`

Prefer the explicit Upstash names for this project unless the Vercel integration creates KV names automatically.

## 4. Configure Vercel Environment Variables

Required:

```text
SEND_TOKEN=<random sender token>
RECEIVER_TOKEN=<different random receiver token>
UPSTASH_REDIS_REST_URL=<Upstash REST URL>
UPSTASH_REDIS_REST_TOKEN=<Upstash REST token>
```

Optional first-version defaults:

```text
MAX_MESSAGE_CHARS=32
SENDER_RATE_LIMIT_COUNT=10
SENDER_RATE_LIMIT_WINDOW_SECONDS=60
TRANSIENT_QUEUE_LIMIT=5
DEFAULT_TRANSIENT_TTL_SECONDS=300
DEFAULT_DISPLAY_SECONDS=20
MIN_TTL_SECONDS=1
MAX_TTL_SECONDS=86400
MIN_DISPLAY_SECONDS=1
MAX_DISPLAY_SECONDS=300
REDIS_KEY_PREFIX=k20gt:remote-message
```

After changing environment variables in Vercel, redeploy the project.

## 5. Smoke Test the Online API

Set local PowerShell variables for the deployed API:

```powershell
$env:REMOTE_MESSAGE_API_BASE_URL = "https://your-vercel-project.vercel.app"
$env:SEND_TOKEN = "replace-with-the-vercel-send-token"
$env:RECEIVER_TOKEN = "replace-with-the-vercel-receiver-token"
```

Create a sticky message:

```powershell
curl.exe -X POST "$env:REMOTE_MESSAGE_API_BASE_URL/api/messages" `
  -H "Authorization: Bearer $env:SEND_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"type\":\"sticky\",\"text\":\"今天别熬夜\"}"
```

Create a transient message:

```powershell
curl.exe -X POST "$env:REMOTE_MESSAGE_API_BASE_URL/api/messages" `
  -H "Authorization: Bearer $env:SEND_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"type\":\"transient\",\"text\":\"喝水\",\"ttlSeconds\":300,\"displaySeconds\":20}"
```

Pull the next message as the receiver:

```powershell
curl.exe "$env:REMOTE_MESSAGE_API_BASE_URL/api/messages/next" `
  -H "Authorization: Bearer $env:RECEIVER_TOKEN"
```

Copy the returned message `id`, then acknowledge it:

```powershell
$messageId = "replace-with-returned-message-id"
curl.exe -X POST "$env:REMOTE_MESSAGE_API_BASE_URL/api/messages/$messageId/ack" `
  -H "Authorization: Bearer $env:RECEIVER_TOKEN"
```

Clear the current sticky:

```powershell
curl.exe -X POST "$env:REMOTE_MESSAGE_API_BASE_URL/api/messages/clear" `
  -H "Authorization: Bearer $env:SEND_TOKEN"
```

Expected results:

- `POST /api/messages` returns HTTP `201` with a `message`.
- `GET /api/messages/next` returns HTTP `200` with either a `message` or `message: null`.
- `POST /api/messages/{id}/ack` returns HTTP `200` with `acknowledged`.
- `POST /api/messages/clear` returns HTTP `200`.

## 5.1 Smoke Test the Web Sender

Open the deployed root page:

```text
https://your-vercel-project.vercel.app/
```

Enter only `SEND_TOKEN` in the page. Do not enter `RECEIVER_TOKEN`; it belongs only in Vercel environment variables and on the trusted receiver computer.

Manual checks:

- Send `贴上去` with a short message.
- Send `显示一下` with a short message.
- Click `清空贴上去`.
- Try a wrong token and confirm the page shows `unauthorized`.

The page stores the send token in browser `localStorage` when the remember checkbox is enabled. This is a first-version convenience for trusted browsers.

## 6. Run the Local Receiver Against Vercel

On the receiver computer:

```powershell
$env:REMOTE_MESSAGE_API_BASE_URL = "https://your-vercel-project.vercel.app"
$env:RECEIVER_TOKEN = "replace-with-the-vercel-receiver-token"
$env:RECEIVER_POLL_INTERVAL_MS = "3000"
npm run receiver
```

Then send a message from another terminal:

```powershell
$env:REMOTE_MESSAGE_API_BASE_URL = "https://your-vercel-project.vercel.app"
$env:SEND_TOKEN = "replace-with-the-vercel-send-token"
curl.exe -X POST "$env:REMOTE_MESSAGE_API_BASE_URL/api/messages" `
  -H "Authorization: Bearer $env:SEND_TOKEN" `
  -H "Content-Type: application/json" `
  -d "{\"type\":\"transient\",\"text\":\"线上测试\",\"ttlSeconds\":300,\"displaySeconds\":20}"
```

The receiver should poll the online API, write the returned text to the connected `MCHOSE K20 GT` screen, and ack only after a successful local write.

## Manual Checklist

- [ ] GitHub push to `Melody-learning/maicong.git` completed manually.
- [ ] Vercel project created from the GitHub repository.
- [ ] Upstash Redis created or connected.
- [ ] Vercel environment variables configured.
- [ ] Vercel production deployment completed.
- [ ] `POST /api/messages` can create a sticky message.
- [ ] `POST /api/messages` can create a transient message.
- [ ] `GET /api/messages/next` can pull a message.
- [ ] `POST /api/messages/{id}/ack` can acknowledge a message.
- [ ] Root web sender can create `贴上去` and `显示一下` messages with `SEND_TOKEN`.
- [ ] Root web sender can clear the current sticky with `SEND_TOKEN`.
- [ ] Local receiver can connect to the deployed API.
- [ ] Field network stability from the actual receiver location has been observed.
