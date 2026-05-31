## Context

The project currently has three useful configuration layers:

- `.env` for production-compatible local values and `.env.local` for development overrides.
- `receiver.config.json` for the current machine's receiver runtime.
- `dist/k20gt-receiver-windows/receiver.config.json` for a private preconfigured bundle delivered to one trusted Windows machine.

The problem is source priority. The receiver runtime should prefer `receiver.config.json` because it is a convenient current-machine override. The bundle generator, however, should not treat that same current-machine file as the default production delivery source, because it can point to `localhost` for development. The existing generated bundle is configured for the deployed Vercel URL, but rerunning the current default command while a local `receiver.config.json` exists could generate a broken package for another machine.

## Goals / Non-Goals

**Goals:**

- Make default bundle generation safe for the private production receiver package.
- Keep local development and current-machine receiver runs convenient.
- Make local/loopback bundle output an explicit choice.
- Regenerate the private receiver folder and zip from the current checkout after the fix.

**Non-Goals:**

- No account registration, login, pairing code, multi-device token model, tray app, `.exe`, `.msi`, or Windows service.
- No cloud API route or board state model change.
- No change to the receiver's runtime config precedence when actually running the receiver.

## Decisions

1. Default bundle generation will prefer explicit CLI values, `BUNDLE_*` environment values, and `.env` deployment values over `receiver.config.json`.

   Rationale: `.env` currently represents the cloud service contract shared with Vercel, while `receiver.config.json` and `.env.local` are useful for the developer's current machine. Reusing `.env` for default production bundle generation avoids copying a local-only receiver config or dev token pair by accident.

   Alternative considered: keep `receiver.config.json` as default and warn when it contains localhost. This still makes the most common command depend on a file whose purpose is ambiguous.

2. `--config-source <file>` remains available and intentionally copies that JSON file.

   Rationale: there are valid cases for building a bundle from a prepared private config file. Making the source explicit keeps that power while removing the accidental default.

3. Bundle generation will refuse local/loopback API URLs unless an explicit local-bundle override is provided.

   Rationale: a package for another Windows machine cannot use the developer's `localhost`. If a local bundle is needed for testing, that should be obvious in the command.

4. The generated zip will be refreshed after code and docs pass tests.

   Rationale: the current zip's credentials are correct, but its timestamp predates later receiver/web changes. Refreshing aligns the delivered artifact with the current development version.

5. `.env.local` will hold a separate local development token pair and dev Redis key prefix.

   Rationale: local web/API/receiver testing should not use the production sender/receiver tokens or write into the production board keys. Keeping the same Upstash instance with a dev key prefix is enough for the current private project and avoids provisioning another database immediately.

## Risks / Trade-offs

- Existing muscle memory for `npm run receiver:bundle` changes behavior when a local `receiver.config.json` exists → Mitigation: update docs and tests to make the new source priority explicit.
- Developers may still need a localhost bundle for testing → Mitigation: provide an explicit `--allow-localhost` flag and matching environment variable.
- `.env.local` can contain dev-only values that must not enter production bundles → Mitigation: default bundle generation excludes `.env.local`; a local test bundle must explicitly opt in.
