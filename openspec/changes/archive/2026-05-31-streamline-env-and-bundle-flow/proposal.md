## Why

The current private receiver flow has the right pieces, but development, production, and delivery credentials can still overlap in surprising ways. A local `receiver.config.json` can make day-to-day receiver runs convenient while also becoming the accidental source for a production bundle, including the dangerous case of packaging a `localhost` API URL for another machine.

## What Changes

- Make receiver bundle generation intentionally production-oriented by default, using `.env` / `.env.local` and explicit bundle environment values before falling back to a local receiver config file.
- Reserve `.env.local` for local development overrides with a separate dev sender/receiver token pair and a dev Redis key prefix.
- Add safeguards so the default private bundle command refuses to package a `localhost` or loopback API URL unless explicitly allowed.
- Keep local receiver development convenient: `receiver.config.json` remains valid for the current machine, while `.env` / `.env.local` remain the shared development and deployment token source.
- Add or update tests that cover bundle config source priority, localhost refusal, and explicit local-bundle override behavior.
- Update documentation to describe the three configuration layers: development, deployed cloud service, and private receiver bundle.
- Regenerate the private Windows receiver folder and zip from the current development version after safeguards are in place, while keeping the production bundle on the existing production token pair.

No account system, login flow, pairing code, tray UI, installer format change, or cloud API contract change is included.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `receiver-windows-runtime`: private receiver bundle generation must avoid accidentally packaging local development endpoints and must support a clear production-bundle path.
- `local-message-receiver`: local development configuration documentation and behavior expectations must clearly separate current-machine config from bundle delivery config.

## Impact

- `scripts/prepare-receiver-bundle.js`
- `lib/receiver-bundle.js`
- Receiver bundle tests
- `docs/local-message-receiver.md`
- `docs/vercel-deployment.md` and related token-flow documentation if needed
- Generated git-ignored `dist/k20gt-receiver-windows/` and `dist/k20gt-receiver-windows.zip`
