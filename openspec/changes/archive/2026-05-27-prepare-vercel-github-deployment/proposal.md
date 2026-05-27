## Why

The remote API and local receiver are implemented, but the project is not yet packaged for a safe GitHub commit and manual Vercel deployment. Before real field validation, the repository needs clear secret hygiene, deployment configuration guidance, and smoke-test instructions that can be followed without exposing local tokens or touching remote accounts from this workspace.

## What Changes

- Add repository ignore rules for dependencies, local secrets, Vercel metadata, temporary extraction folders, logs, caches, and system files.
- Add an environment variable example file with placeholder-only values for the Vercel API and local receiver.
- Add a GitHub + Vercel + Upstash deployment guide for the target repository `Melody-learning/maicong.git`.
- Include manual smoke-test commands for creating, pulling, acknowledging, clearing, and receiver-testing online messages.
- Review `package.json` for Vercel suitability without changing API or receiver behavior unless a deployment blocker is found.
- Update project progress documentation after implementation.

## Capabilities

### New Capabilities
- `deployment-readiness`: Documents and repository safeguards needed to manually publish the existing API/receiver project to GitHub and Vercel.

### Modified Capabilities
- None.

## Impact

- Affected files: `.gitignore`, `.env.example`, `docs/vercel-deployment.md`, `AGENTS.md`, and OpenSpec change artifacts.
- No changes to remote message API behavior.
- No changes to local receiver behavior.
- No GitHub push, remote repository creation, Vercel account operation, or official MCHOSE HUB installation directory modification.
