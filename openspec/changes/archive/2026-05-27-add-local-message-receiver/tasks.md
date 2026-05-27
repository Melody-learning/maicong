## 1. Screen Writer Sharing

- [x] 1.1 Move reusable K20 GT screen-writing logic into `lib/k20gt-screen-writer.js`.
- [x] 1.2 Keep `k20gt-screen.js` as a CLI wrapper and preserve `npm run screen -- "文本"` behavior.

## 2. Receiver Implementation

- [x] 2.1 Add receiver configuration parsing for API base URL, token, poll interval, and log level.
- [x] 2.2 Implement next-message fetch and ack request helpers using bearer auth.
- [x] 2.3 Implement a testable single polling iteration: null does nothing, message writes screen then ack, write failure skips ack.
- [x] 2.4 Implement the continuous polling loop with recoverable errors and Ctrl+C graceful shutdown.
- [x] 2.5 Add `k20gt-receiver.js` and `npm run receiver`.

## 3. Tests and Verification

- [x] 3.1 Add receiver unit tests for null responses, message write then ack, write failure without ack, request failure resilience, ack failure resilience, and configuration handling.
- [x] 3.2 Run the existing test suite and OpenSpec validation/status for `add-local-message-receiver`.

## 4. Documentation and Closeout

- [x] 4.1 Document receiver environment variables, manual run commands, and Node 18+ native fetch expectation.
- [x] 4.2 Update `AGENTS.md` and necessary research/project notes to record that the first local receiver is implemented and tray/pause/autostart remain future work.
- [x] 4.3 Confirm no official `MCHOSE HUB` installation files were modified.
