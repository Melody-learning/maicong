# Project History and Decision Index

This document keeps the historical context that no longer belongs in the compact `AGENTS.md` handoff file.

## Milestones

- Local HID write was verified with `node-hid`; `k20gt-screen.js` can write custom text to a connected `MCHOSE K20 GT`.
- `K20GT_RESEARCH.md` recorded the core protocol facts: report `188`, endpoint `MI_03 Col01`, `cmd 29` custom text, `cmd 9` screen state, `cmd 11` lyric switch, and the observed restore payload `[1,112,241,142,0,0,2]`.
- `add-remote-message-api` built the first Vercel + Upstash Redis API using the older sticky/transient message model.
- `add-local-message-receiver` added the first polling receiver that writes messages to the screen and acknowledges successful writes.
- `prepare-vercel-github-deployment` prepared GitHub/Vercel/Upstash deployment docs and smoke-test steps.
- A real online loop was verified: Vercel API -> Upstash Redis -> local receiver -> real K20 GT screen.
- `add-web-message-sender` added the first root web sender page.
- `probe-display-restore-mode` confirmed that lyric restore alone is not enough to clear the remote custom-text baseline, and that the observed official preset payload can restore the baseline from `REMOTE BASE`.
- `add-receiver-display-restore` connected conservative restore behavior to the receiver.
- `add-receiver-display-controls` added receiver-side dismiss, local DND, and one-shot local control semantics.
- `add-display-status-and-web-controls` added cross-end display status summaries for the sender page.
- `add-receiver-config-and-local-controls` added `receiver.config.json`, `receiver.config.example.json`, receiver control CLI commands, and npm scripts.
- `package-receiver-installer` added Windows script-level background running, PID/log/status handling, and Task Scheduler login autostart.
- `package-preconfigured-receiver-bundle` added private preconfigured Windows bundle generation.
- `simplify-remote-display-to-expiring-board` retired the sticky/transient product contract and replaced it with one expiring board.
- `add-board-history-view` added a bounded recent-board history index, `GET /api/board/history`, and the sender-page history view.

## Retired Model

Early versions modeled remote display as:

- `sticky`: a sustained remote target that could remain on screen.
- `transient`: a short one-time display task.
- `/api/messages`, `/api/messages/next`, `/api/messages/{id}/ack`, and `/api/messages/clear`.

That model is now retired in the active product contract. Current clients should use `/api/board`. Legacy message routes return HTTP `410` with `messages_api_retired`.

Historical sticky/transient notes remain useful only for understanding older OpenSpec archives and some compatibility names in code/tests.

## Where Details Live

- Protocol and physical-device observations: `K20GT_RESEARCH.md`.
- Current API contract: `docs/remote-message-api.md`.
- Receiver runtime and bundle details: `docs/local-message-receiver.md`.
- Web sender behavior: `docs/web-message-sender.md`.
- Deployment and smoke testing: `docs/vercel-deployment.md`, `docs/vercel-upstash-smoke-test-report.md`, `docs/web-message-sender-smoke-test-report.md`.
- Board-model verification scope: `docs/expiring-board-verification.md`.
- Display ownership/DND/dismiss design background: `docs/receiver-display-ownership-and-controls-report.md`.
- Formal archived changes: `openspec/changes/archive/`.
- Current normative requirements: `openspec/specs/`.

## Notes for Future Updates

- Keep `AGENTS.md` focused on current truth, commands, file map, constraints, and next-step orientation.
- Add detailed protocol observations to `K20GT_RESEARCH.md`, not to `AGENTS.md`.
- Add operational instructions to the relevant `docs/` file, not to `AGENTS.md`.
- Add formal behavior changes through OpenSpec when requirements are still shifting.
