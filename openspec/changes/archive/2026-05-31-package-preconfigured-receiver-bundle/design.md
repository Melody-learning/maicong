## Context

The receiver already has the runtime pieces needed on a Windows target machine: `receiver.config.json`, npm commands, PowerShell start/stop/status/autostart scripts, PID/log management, and local control commands. The remaining friction is distribution shape. A trusted recipient should not need to understand the repository or hand-edit tokens, but the project is not ready for a public installer, tray app, service, or GUI.

This change packages the current repository into a private, preconfigured folder. The bundle is intentionally boring and inspectable: it contains the same Node project, a private `receiver.config.json`, and `.cmd` wrappers that call existing npm scripts. The generated output is local-only and git-ignored because it contains secrets.

## Goals / Non-Goals

**Goals:**

- Generate an ignored Windows bundle folder that can be zipped or copied to one trusted machine.
- Include a preconfigured private `receiver.config.json` in the bundle without ever committing real tokens.
- Provide double-clickable `.cmd` wrappers for install, start, stop, status, autostart on/off, DND on/off, dismiss, and restore.
- Reuse existing runtime paths, PID duplicate checks, log handling, control CLI, and Task Scheduler autostart behavior.
- Keep token values out of install/status output and generated README examples.
- Make the bundle workflow testable without requiring a real Windows Task Scheduler run in tests.

**Non-Goals:**

- No Electron/Tauri tray app.
- No `.exe` or `.msi` installer.
- No Windows service.
- No GUI config editor or interactive first-run wizard.
- No public distribution workflow.
- No cloud API, message state, polling, DND authority, or auth model changes.
- No automatic token generation or remote secret provisioning.

## Decisions

### Extend `receiver-windows-runtime`

The new behavior belongs in `receiver-windows-runtime` because the bundle is a distribution surface for the existing Windows script runtime. It does not introduce a new runtime state machine or cloud capability. A future tray app can still reuse the same start/stop/control/autostart scripts.

Alternative considered: create a separate `receiver-preconfigured-bundle` capability. That would make the concept visible, but it would split requirements that are operationally one Windows runtime surface.

### Generate A Project-Shaped Bundle

The bundle should contain the files needed to run the existing Node project from its own folder, including source files, scripts, package files, public/API files only as needed by dependencies, docs, and a private `receiver.config.json`. Generated runtime paths stay relative to the bundle root:

```text
dist/k20gt-receiver-windows/
  install.cmd
  start.cmd
  stop.cmd
  status.cmd
  autostart-on.cmd
  autostart-off.cmd
  dnd-on.cmd
  dnd-off.cmd
  dismiss.cmd
  restore.cmd
  receiver.config.json
  package.json
  package-lock.json
  k20gt-receiver.js
  k20gt-receiver-control.js
  lib/
  scripts/
  logs/       runtime-created
  .receiver/  runtime-created
  README.md
```

Copying the project-shaped runtime avoids inventing a second install layout. It also means the existing PID metadata project-root checks continue to protect duplicate starts and safe stops inside the copied bundle.

Alternative considered: generate only wrapper scripts that point back to the developer checkout. That is easier, but it would leave the target user dependent on the developer workspace path and make copying/zipping unreliable.

### `.cmd` Wrappers Over New Runtime Logic

Each `.cmd` wrapper should set its working directory to the bundle root and call the existing npm script or PowerShell entrypoint. The wrappers are convenience doors, not a new implementation layer. This keeps the user surface simple while preserving tested runtime behavior.

`install.cmd` should run the existing install/config check and install dependencies if needed. The first version can choose a conservative dependency step such as `npm install` or `npm ci` based on local package files, but it must not print token values. Other wrappers should map directly:

- `start.cmd` -> `npm run receiver:start`
- `stop.cmd` -> `npm run receiver:stop`
- `status.cmd` -> local runtime status and/or cloud receiver status through existing scripts
- `autostart-on.cmd` / `autostart-off.cmd` -> existing autostart npm scripts
- `dnd-on.cmd` / `dnd-off.cmd` / `dismiss.cmd` / `restore.cmd` -> existing local control npm scripts

### Config Sources Are Local And Explicit

The generator should support two safe private-config flows:

- copy an existing ignored `receiver.config.json` into the generated bundle; or
- write a bundle config from explicit local input such as environment variables or command arguments.

In both cases, real tokens only land in the ignored bundle output. The repository continues to track only placeholder examples. The generator must keep `receiverToken` and `sendToken` separate and must not substitute one for the other.

### Token Redaction Is Required At Every Human Output Boundary

The existing install/status scripts already report only whether tokens are configured. The bundle generator should follow the same pattern: it can say which config source was used and whether receiver/send tokens exist, but it must not echo token values. Generated README content should describe placeholders and safety rules without embedding real secrets.

### Git Ignore Generated Output

The canonical bundle output should be under `dist/`, and `dist/` should be ignored. This keeps private configs, copied runtime logs, copied PID files, and zipped bundles out of version control by default.

## Risks / Trade-offs

- Private bundle contains secrets -> Mitigation: generate only into ignored `dist/`, document private handling, and avoid token output.
- Node/native `node-hid` install may fail on the target machine -> Mitigation: `install.cmd` runs dependency checks/install and leaves visible npm output for troubleshooting.
- Bundle may accidentally include stale runtime files -> Mitigation: generator excludes `logs/`, `.receiver/`, existing `dist/`, `.git/`, `node_modules/`, and other local-only artifacts.
- Target user may run wrappers from another directory -> Mitigation: each `.cmd` changes to its own directory before invoking npm scripts.
- Two copied bundles could each have their own autostart task name -> Mitigation: first version keeps existing Task Scheduler name; later multi-profile support can parameterize the task if needed.

## Migration Plan

No migration is required for existing developer workflows. The current npm scripts and direct PowerShell scripts continue to work. Developers can create a private bundle when needed, test it locally, then zip or copy the ignored output folder. Deleting the generated `dist/` folder rolls back the packaging output.

## Open Questions

- Whether `install.cmd` should default to `npm install` or prefer `npm ci` when `package-lock.json` is present.
- Whether the first generator should copy broad project files with an exclude list or use a strict include manifest. A strict manifest is safer for secrets; an exclude list is less likely to miss runtime dependencies.
