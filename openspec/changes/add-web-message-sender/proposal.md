## Why

The remote message pipeline is already verified end to end, but sending still requires curl or PowerShell. A minimal web sender makes the first product loop usable from phone and desktop without changing the receiver or device protocol.

## What Changes

- Add a small same-origin web page for sending K20 GT screen messages.
- Let users enter a send token in the browser and create either "贴上去" or "显示一下" messages.
- Add a clear-sticky action from the same page.
- Show readable success, loading, and API error states.
- Document first-version usage and token handling.
- Do not add login, multi-user support, bot integrations, receiver packaging, long-text strategy, sound/TTS, or deployment-protection bypass behavior.

## Capabilities

### New Capabilities

- `web-message-sender`: Browser-based sender UI for creating sticky/transient messages and clearing the current sticky using the existing remote message API.

### Modified Capabilities

None.

## Impact

- Adds static web assets for Vercel hosting.
- Uses existing `POST /api/messages` and `POST /api/messages/clear` endpoints without new dependencies.
- Updates docs and project progress notes.
- Keeps secrets out of source; users provide `SEND_TOKEN` at runtime in the browser.
