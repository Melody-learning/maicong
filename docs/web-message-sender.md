# Web Message Sender

This page adds the first minimal browser sender for the existing remote message API. It does not add login, Telegram, WeChat, multi-user support, receiver packaging, long-text strategy, sound, or TTS.

Local-to-device smoke test results are recorded in `docs/web-message-sender-smoke-test-report.md`.

## Open the Page

Local development:

```powershell
npm run vercel:dev
```

Then open:

```text
http://localhost:3000/
```

Production:

```text
https://your-vercel-project.vercel.app/
```

The root page is the sender tool itself, not a marketing landing page.

## Token

Enter only the Vercel `SEND_TOKEN` value in the page.

Do not enter `RECEIVER_TOKEN` in the page. The receiver token is only for the local receiver computer and receiver API calls.

The first version keeps the send token in `localStorage` when "在这个浏览器记住发送 token" is checked. This is a debugging and convenience choice for trusted browsers. Uncheck it before sending if the browser is shared or temporary.

## Sending

Use:

- `贴上去`: creates a `sticky` message through `POST /api/messages`.
- `显示一下`: creates a `transient` message through `POST /api/messages`.
- `清空贴上去`: clears the current sticky through `POST /api/messages/clear`.

The page sends requests to the same origin as the hosted Vercel API:

```text
Authorization: Bearer <SEND_TOKEN>
Content-Type: application/json
```

The page intentionally does not hard-code the long-term text length limit. Server validation remains the source of truth. Short messages are still more reliable for the current K20 GT display behavior.

## Error Feedback

The page shows the API error type when possible, including:

- `unauthorized`: missing or wrong send token.
- `validation_failed`: message text or timing failed server validation.
- `rate_limited`: sender rate limit was reached.
- `queue_full`: transient queue is full.
- `missing_config`: Vercel environment variables or Redis configuration are incomplete.

## Manual Checks

1. Open `/`.
2. Enter the deployed `SEND_TOKEN`.
3. Select `贴上去`, enter a short message, and send.
4. Confirm the page reports success and the local receiver eventually displays the message.
5. Select `显示一下`, enter another short message, and send.
6. Click `清空贴上去` and confirm the page reports whether a sticky was cleared.
7. Try an intentionally wrong token and confirm the page shows `unauthorized`.
