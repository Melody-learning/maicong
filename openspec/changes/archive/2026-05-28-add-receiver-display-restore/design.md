## Context

The receiver's known visible-write sequence remains:

1. `cmd 11` lyric switch off.
2. `cmd 9` custom-text foreground state.
3. `cmd 29` custom text.

Probe work confirmed that `cmd 11 lyricSwitch=1` can resume lyric overlay when lyrics are available, but it does not clear the remote custom-text baseline underneath. The official client screen-state payload shape has been derived as `[screenSwitch, G, R, B, mode, curTheme, index]`, and the observed preset payload `[1,112,241,142,0,0,2]` can replace a `REMOTE BASE` remote custom-text baseline.

## Design

### Screen Writer Helpers

Keep `setScreenText()` as the stable user-facing local write helper. Add small lower-level helpers:

- `setLyricEnabled(enabled, options)` writes `cmd 11` with an empty lyric payload and `lyricSwitch` `1` or `0`.
- `writeScreenState(payload)` validates and writes a `cmd 9` byte payload.
- `restorePresetState(payload)` writes the configured/fallback preset payload through `cmd 9`.
- `restoreDisplay(options)` writes the screen-state payload first, then optionally re-enables lyrics.

The restore order is screen state first, lyric switch second. This avoids leaving the remote custom-text baseline underneath lyric gaps after restore, then lets active lyrics overlay the restored baseline.

### Receiver Configuration

Add defaults:

- `RECEIVER_RESTORE_ON_EMPTY=true`
- `RECEIVER_RESTORE_LYRIC=true`
- `RECEIVER_RESTORE_SCREEN_STATE=1,112,241,142,0,0,2`
- `RECEIVER_TRANSIENT_RESTORE_DELAY_MS` optional; default `0`

`RECEIVER_RESTORE_SCREEN_STATE` accepts a comma-separated byte payload. An empty value disables screen-state restore while still allowing lyric restore if configured.

### Receiver Display Session

Maintain a minimal local session object across loop ticks:

- `lastDisplayedMessageId`
- `lastDisplayedType`
- `activeStickyId`
- `remoteDisplayActive`

Rules:

- `sticky`: write text, ack, mark `remoteDisplayActive=true` and `activeStickyId=message.id`.
- `transient`: write text, ack, mark `remoteDisplayActive=true` and clear `activeStickyId`.
- `null`: if `remoteDisplayActive` is true and restore-on-empty is enabled, call `restoreDisplay()` once and then mark remote display inactive. Consecutive null polls do not repeat restore.
- `transient -> sticky`: the next loop writes sticky and does not restore because the remote system still has a target.
- Screen write failure: do not ack and do not restore over the current device state.
- Ack failure: log the error and keep the local display session updated so later empty polls can still release remote occupation.
- Restore failure: log the error, keep the receiver loop alive, and mark remote display inactive only if restore succeeded.

The receiver still relies on server scheduling for `displaySeconds`; it does not locally sleep through a transient. Once a transient is acked, the next server result decides whether to show sticky or release.

## Risks

- The fallback preset payload is derived from one observed official state and may not match every user's preferred baseline. It is configurable and can be disabled.
- Receiver memory is process-local. If the receiver restarts while remote text is visible and the server has no active target, it will not know to restore unless a future control feature adds explicit startup recovery.
- Ack failure after a successful write may cause the server to retry a message while the local receiver also considers the display active. This preserves the existing conservative "write succeeded, ack failed" behavior and avoids clearing a potentially visible message prematurely.
