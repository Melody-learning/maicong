## Why

The remote API, local receiver, web sender, and real Vercel/Upstash/device loop now work, but the receiver still behaves like a one-way screen takeover. Probe results show that writing remote text leaves the K20 GT in a remote custom-text baseline unless another command restores the native display mode.

This change connects the confirmed restore path to the local receiver so transient messages and cleared sticky messages can release their remote display occupation conservatively.

## What Changes

- Add receiver display restore behavior for the transition from an active remote target to no remote target.
- Restore the current remote `sticky` after a `transient` when the server still returns a sticky target.
- Restore the native-ish baseline and lyric switch when a `transient` ends with no sticky, or when a sticky is cleared and `/next` returns `null`.
- Expose conservative receiver restore configuration through environment variables.
- Add screen-writer helpers for lyric toggle, `cmd 9` screen-state writes, preset restore, and combined restore.
- Keep `npm run screen -- "文本"` unchanged.
- Add unit tests for restore triggering, non-repetition, failure behavior, and configuration parsing.
- Document the fallback preset payload and the limits of lyric restoration.

## Non-goals

- Do not change the cloud message state machine or web sender behavior.
- Do not implement tray, autostart, Windows service, GUI settings, accounts, multi-device support, Telegram, or WeChat.
- Do not make segmented long text a default display strategy.
- Do not promise restoration of the user's official custom-text content; first version restores a known/configurable preset baseline and lyric switch only.
- Do not modify files under the official `MCHOSE HUB` installation directory.

## Capabilities

### Modified Capabilities

- `local-message-receiver`: Adds display occupation tracking and release/restore behavior after remote display targets end.
