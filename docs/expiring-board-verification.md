# Expiring Board Verification

`simplify-remote-display-to-expiring-board` was verified on 2026-05-29 with automated tests only.

Covered:

- Board validation, duration bounds, legacy sticky/transient rejection, and token authorization.
- Board storage create/replace/expire/read-null/displayed/clear/dismiss/rate-limit behavior.
- Board API endpoints, display status shape, and retired legacy `/api/messages` behavior.
- Local receiver board polling, same-board no-rewrite, displayed-report-after-write, empty-board restore, DND, dismiss, status reporting, and failure resilience.
- Web sender payload/status behavior by code and test coverage, without requiring a connected K20 GT.

Not covered:

- Live HID display on a physical `MCHOSE K20 GT`.
- Long-running network stability on the target receiver machine.
- Real Vercel production smoke test after deployment.
