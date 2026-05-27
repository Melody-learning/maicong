## Context

The project already has a Vercel-style `api/` directory, Upstash Redis storage, token-protected sender/receiver endpoints, and a local Node receiver. The next milestone is manual GitHub and Vercel setup for real field validation, but this workspace must not push code, create remote repositories, operate cloud accounts, or store real secrets in tracked files.

## Goals / Non-Goals

**Goals:**
- Make the repository safe to commit by ignoring local dependencies, secrets, Vercel metadata, temporary extraction folders, logs, caches, and system files.
- Provide placeholder-only environment examples for both cloud API and local receiver configuration.
- Provide a deployment guide that covers GitHub, Vercel, Upstash Redis, required environment variables, curl smoke tests, and receiver startup.
- Preserve current API and receiver behavior.

**Non-Goals:**
- No web sender UI.
- No remote deployment or `git push`.
- No GitHub/Vercel/Upstash account automation.
- No change to HID write behavior, receiver polling behavior, or message scheduling semantics.
- No modification of the official MCHOSE HUB installation directory.

## Decisions

- Use `.env.example` for placeholders only.
  - Rationale: it gives deployers a single variable inventory without encouraging accidental secret commits.
  - Alternative considered: split `.env.vercel.example` and `.env.receiver.example`; rejected for now because the first deployment path is small enough for one file with clear sections.

- Ignore all `.env` and `.env.*` files while explicitly allowing `.env.example`.
  - Rationale: the safest default is to treat every local environment file as secret-bearing except the documented template.
  - Alternative considered: allow `.env.local.example`; not needed until there are multiple templates.

- Keep deployment guidance in `docs/vercel-deployment.md`.
  - Rationale: deployment is an operator workflow, not API reference. Existing `docs/remote-message-api.md` and `docs/local-message-receiver.md` remain focused references.
  - Alternative considered: expand existing API docs; rejected because it would mix endpoint reference with account setup and manual checklist.

- Do not add new runtime dependencies or scripts unless package review finds a blocker.
  - Rationale: Vercel can serve the existing `api/` functions, and the receiver remains a local script.
  - Alternative considered: adding a build script; unnecessary for the current no-build Node API layout.

## Risks / Trade-offs

- Real tokens can still be pasted into tracked docs by mistake -> mitigation: documentation explicitly warns against committing real tokens and `.gitignore` blocks common env files.
- Curl examples can drift from API behavior -> mitigation: commands use the existing documented endpoints and token headers.
- Vercel + Upstash may be unstable from domestic networks -> mitigation: deployment guide calls this out as requiring later field validation, not as a solved production guarantee.
- `RECEIVER_TOKEN` is needed by local receiver smoke tests -> mitigation: docs keep it out of browser/frontend contexts and limit it to Vercel env plus the trusted local receiver environment.
