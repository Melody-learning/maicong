## 1. Repository Safety

- [x] 1.1 Add or update `.gitignore` for dependencies, secrets, Vercel metadata, temporary directories, logs, caches, and system files.
- [x] 1.2 Add `.env.example` with placeholder-only cloud API and local receiver variables.
- [x] 1.3 Review `package.json` for Vercel suitability and avoid behavior changes unless a blocker is found.

## 2. Deployment Documentation

- [x] 2.1 Add `docs/vercel-deployment.md` with GitHub, Vercel, Upstash Redis, and environment variable setup steps.
- [x] 2.2 Add online API and local receiver smoke-test commands for sticky and transient messages.
- [x] 2.3 Include deployment safety notes and a manual checklist.

## 3. Project Progress and Verification

- [x] 3.1 Update `AGENTS.md` current progress to record deployment preparation completion and keep field validation as future work.
- [x] 3.2 Run `npm test` and fix any regressions.
- [x] 3.3 Run `openspec validate prepare-vercel-github-deployment --strict` and fix any issues.
