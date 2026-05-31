## 1. Bundle Design And Script Surface

- [x] 1.1 Audit current Windows runtime scripts and decide the exact generated bundle include/exclude list.
- [x] 1.2 Define the generated `.cmd` wrapper template and command mapping for install/start/stop/status/autostart/DND/dismiss/restore.

## 2. Bundle Generator

- [x] 2.1 Add a testable JS helper for bundle paths, copy filters, wrapper content generation, config redaction, and README generation.
- [x] 2.2 Add a CLI script to prepare the private Windows bundle at `dist/k20gt-receiver-windows/`.
- [x] 2.3 Support copying an existing local ignored `receiver.config.json` into the bundle.
- [x] 2.4 Support writing bundle config from explicit local environment values or command arguments without printing token values.
- [x] 2.5 Add an npm script for preparing the private receiver bundle.

## 3. Generated Bundle Contents

- [x] 3.1 Generate `.cmd` wrappers for install, start, stop, status, autostart-on, autostart-off, dnd-on, dnd-off, dismiss, and restore.
- [x] 3.2 Generate bundle README content that explains private handling, first run, daily commands, logs, autostart, cleanup, and token safety.
- [x] 3.3 Ensure generated output excludes `node_modules`, logs, PID metadata, existing `dist`, git metadata, and other local-only artifacts.
- [x] 3.4 Ensure `dist/` or the chosen bundle output path is git-ignored.

## 4. Documentation And Project Notes

- [x] 4.1 Update `docs/local-message-receiver.md` with the private preconfigured bundle workflow.
- [x] 4.2 Update `AGENTS.md` progress, common command notes, and packaging direction.

## 5. Tests

- [x] 5.1 Add tests for bundle generation path and generated command wrapper targets.
- [x] 5.2 Add tests for config copy behavior and config creation from local input.
- [x] 5.3 Add tests that bundle generator summaries and generated non-config docs do not print token values.
- [x] 5.4 Add tests that excluded runtime/local directories are not copied into the bundle.

## 6. Verification

- [x] 6.1 Run `npm test`.
- [x] 6.2 Run `openspec validate package-preconfigured-receiver-bundle --strict`.
