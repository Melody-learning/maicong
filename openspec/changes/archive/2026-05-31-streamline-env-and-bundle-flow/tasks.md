## 1. Bundle Config Safeguards

- [x] 1.1 Change default bundle config resolution so explicit arguments and `BUNDLE_*` / `.env` values are used before any local `receiver.config.json`.
- [x] 1.2 Keep explicit `--config-source` support for intentionally copying a prepared receiver config file.
- [x] 1.3 Add localhost/loopback API URL rejection for default bundle generation and an explicit override for local test bundles.

## 2. Tests And Documentation

- [x] 2.1 Add tests for bundle source priority, explicit config source behavior, localhost rejection, and localhost override.
- [x] 2.2 Update receiver/deployment docs to describe development, cloud, and private bundle configuration layers.

## 3. Verification And Packaging

- [x] 3.1 Run the test suite and strict OpenSpec validation for this change.
- [x] 3.2 Regenerate the private receiver bundle and zip from the current checkout with production credentials.

## 4. Local Development Token Split

- [x] 4.1 Keep production bundle generation on `.env` / `BUNDLE_*` by default and require an explicit opt-in to include `.env.local`.
- [x] 4.2 Add tests for `.env.local` exclusion by default and explicit local-env inclusion for local test bundles.
- [x] 4.3 Create ignored local development config with a separate dev token pair and dev Redis key prefix.
- [x] 4.4 Re-run validation and regenerate the production receiver bundle with the existing production token pair.
