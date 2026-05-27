## Context

The project already has a token-protected Vercel API backed by Upstash Redis/KV and a local receiver that can display messages on a real MCHOSE K20 GT screen. The missing piece for first-version product use is a simple sender interface that avoids command-line HTTP calls.

The UI must live comfortably inside the current Vercel project, avoid large frontend frameworks, and stay aligned with the existing product vocabulary: "贴上去" for sticky and "显示一下" for transient.

## Goals / Non-Goals

**Goals:**

- Provide a usable first screen for sending short messages from mobile and desktop browsers.
- Store only the sender token in browser storage for first-version convenience.
- Call existing same-origin API routes with `Authorization: Bearer <SEND_TOKEN>`.
- Surface common API errors such as `unauthorized`, `validation_failed`, `rate_limited`, and `queue_full`.
- Document manual verification and security boundaries.

**Non-Goals:**

- No registration, login, multi-user, or multi-device model.
- No Telegram, WeChat, sound, TTS, tray app, autostart, or do-not-disturb behavior.
- No long-text, scrolling, lyric-layer, image, or protocol experiments.
- No receiver token exposure in frontend code or documentation examples.

## Decisions

1. Use a static `public/` page.
   - Rationale: Vercel serves `public/index.html` at the root path and same-origin API calls already work with the existing `api/` routes.
   - Alternative considered: Add a server-rendered API page. That adds no useful capability for this simple sender and would mix UI concerns into serverless functions.

2. Keep frontend code dependency-free.
   - Rationale: The page needs a form, a segmented intent control, fetch wrappers, and status messages. Plain HTML/CSS/JS is enough and avoids build tooling.
   - Alternative considered: Introduce a frontend framework. That is too heavy for the current project.

3. Persist the send token in `localStorage` by default.
   - Rationale: This is a first-version debug-friendly tool used by trusted senders, and repeated mobile entry would be awkward.
   - Alternative considered: Use `sessionStorage` only. Safer for shared devices, but less ergonomic; the docs will explicitly call out that the receiver token must never be entered.

4. Let the server own validation limits.
   - Rationale: Text length is still an active device/protocol research topic. The page should not hard-code long-term display limits beyond gentle copy that short messages are more reliable.
   - Alternative considered: Enforce 32 characters in the browser. That would prematurely freeze a product limit already known to need further probing.

## Risks / Trade-offs

- Browser-stored token can be exposed on a shared or compromised device -> Document that only `SEND_TOKEN` belongs in the page and that local storage is a first-version convenience.
- Static UI cannot guarantee API configuration is valid -> Show API error responses clearly so missing config, auth, and validation failures are actionable.
- Mobile text entry and repeated clicks can cause accidental duplicate sends -> Disable controls while requests are in flight and show completion state.
