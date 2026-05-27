# MCHOSE K20 GT screen notes

## Confirmed locally

- Client: `MCHOSE HUB`, installed at `E:\M-HUB\MCHOSE HUB`.
- Device: `MCHOSE K20 GT`.
- USB IDs: vendor `0x3837` / product `0x60c6`.
- Screen HID report: `188`.
- Writable endpoint found by `node-hid`: `MI_03 Col01`.
- A direct custom text write succeeded from this workspace.
- Sending only `cmd 29` updates the custom text cache, but may not switch the visible foreground screen.
- A visible custom text update succeeded after disabling lyric display, switching screen state, then sending `cmd 29`.
- In the default `cmd 29` custom-text path (`testType=1`, `align=1`, `scroll=1`), text longer than the visible area can behave like a marquee/scrolling line, but the default 1.8 s probe interval can switch to the next write before the whole line finishes.
- The local script trims `cmd 29` text to a valid UTF-8 payload at or below 51 bytes before writing. For Chinese-only text this currently means up to 16 complete 3-byte characters per write in the observed long sample.
- Observed `cmd 29` parameter effects with the current custom-text foreground sequence: `scroll=1` moves right-to-left, `scroll=0` and `scroll=2` move left-to-right, and `testType=0` / `testType=2` produce fixed centered display.
- A segmented long-message strategy using repeated `cmd 29` writes is readable only in a rough sense today: segments can interrupt each other before fully finishing, and the device may keep looping the latest shorter segment.
- A limited lyric-layer probe did not show a clearly better long-text path than `cmd 29`; the safe receiver default remains disabling lyric display before writing remote custom text and using pause/do-not-disturb later if lyric preservation matters.

## Useful commands

```powershell
npm run screen -- "晚安，今天也辛苦了"
npm run receiver
npm run probe -- help
npm run probe -- send "K20GT probe" -- --testType=1 --align=1 --scroll=1
npm run probe -- length
npm run probe -- params "K20GT 参数"
npm run probe -- segment "这是一条用于观察分段显示的长消息"
npm run probe -- restore-lyric
npm run probe -- restore-state
npm run probe -- release "REMOTE RELEASE 探测"
npm run probe -- restore-step read
npm run probe -- restore-step lyric-on
npm run probe -- restore-step candidate-mode-0
```

`k20gt-receiver.js` is the first local remote-message receiver. It polls the cloud API, reuses the same screen writer as `k20gt-screen.js`, and only acknowledges a message after the local HID write succeeds.

`k20gt-probe.js` is local-only and finite. It reuses the known visible custom-text sequence and prints JSON summaries for each attempted write so the physical-screen observation can be copied into the table below.

## Packet shape

The K20 GT screen packets are 63 bytes, sent as output report `188`.

```text
offset 0: 0xaa
offset 1: protocol version, usually 0x01
offset 2: checksum flag, 0 for normal set/get commands
offset 3: payload length plus command byte
offset 4: command type byte 0
offset 5: command type byte 1
offset 6: command
offset 7+: payload
```

Known command types:

```text
Request: 00 01
Response: 00 01
Set: 00 02
Notify: 00 04
Image upload: 00 03
```

Useful screen commands:

```text
cmd 29: set screen text
cmd 11: set lyric text
cmd 9: set screen state
cmd 10: theme switch
cmd 15: set screen time
cmd 32: exit lyric display notification
```

For `cmd 29`, payload is:

```text
testType, align, scroll, utf8Length, ...utf8Text
```

The text payload is limited to about 51 UTF-8 bytes per write.

## Visible custom text sequence

The current working script uses this sequence:

```text
1. cmd 11: set lyric display off
2. cmd 9: set screen state to the custom-text-visible state
3. cmd 29: set screen text
```

This matters because the device can report the new custom text through `cmd 7` while the physical screen still shows an older foreground layer.

## Display layer model

Current best model: lyric display and custom text are not a simple "last write wins" pair. The device appears to maintain both cached state and a foreground screen/display mode.

- `cmd 29` updates the custom-text state/cache.
- `cmd 11` controls lyric state, with payload shaped as `lyricSwitch, scroll, utf8Length, ...utf8Text`.
- `cmd 9` changes screen/display state.
- A `cmd 29` write can succeed and be readable through state/readback while the physical screen remains on an older foreground layer.
- The stable custom-text foreground sequence is still: disable lyric display, switch to the custom-text-related screen state, then write `cmd 29`.

Practical priority assumption for product work: treat lyric display as a foreground layer that can cover or prevent custom text from becoming visible. Do not rely on command order alone. A future receiver should disable lyric display before writing remote custom text unless it explicitly implements lyric preservation/restoration or a pause/do-not-disturb mode.

User observation on 2026-05-28: while lyric mode is enabled, a long enough no-lyric vocal section, such as repeated "ooh" with no lyric line, eventually releases the lyric foreground and returns to the prior baseline mode. This supports the model of lyric display as a temporary overlay above a baseline mode, not a permanent replacement for the baseline.

Still unknown: the full priority matrix for every lyric/custom command order is not completely enumerated, and preserving/restoring an active lyric session after a remote message remains a later UX/protocol problem.

## Display restore probes

Goal: find a script-level way to release remote custom-text takeover after a `sticky` or `transient` message, without changing receiver behavior yet.

Restore probing separates four concepts that are easy to blur:

- Stop remote writes: the receiver simply stops sending new `cmd 29` updates.
- Restore lyric overlay: re-enable lyric display so active lyrics can cover the baseline when music has lyrics.
- Restore baseline mode: switch the K20 GT back to personalized preset/time or another native baseline mode instead of remote custom text.
- Restore official custom text: return to whatever custom text the official client had before remote takeover. This is not currently promised because the script does not know that prior content.

### Restore probe commands

`npm run probe -- restore-lyric [--delay=5000]`

Finite sequence:

```text
cmd 11 lyricSwitch=1 scroll=1 text="RESTORE LYRIC 开关探测"
cmd 11 lyricSwitch=0 scroll=1 text=""
cmd 11 lyricSwitch=1 scroll=1 text=""
```

Manual observation target: while music with lyrics is playing, confirm whether the final script-level lyric re-enable resumes the current lyric automatically, matching the official-client observation.

`npm run probe -- restore-state [--delay=5000]`

Finite bounded `cmd 9` candidate matrix:

| Label | Payload | Reason |
| --- | --- | --- |
| `known-custom-text` | `[1,112,241,142,1,4,3]` | Known custom-text foreground state used before `cmd 29`. |
| `candidate-mode-0` | `[1,112,241,142,1,4,0]` | Nearby final mode byte candidate for preset/time baseline. |
| `candidate-mode-1` | `[1,112,241,142,1,4,1]` | Nearby final mode byte candidate for preset/time baseline. |
| `candidate-mode-2` | `[1,112,241,142,1,4,2]` | Nearby final mode byte candidate for preset/time baseline. |
| `candidate-mode-4` | `[1,112,241,142,1,4,4]` | Nearby final mode byte candidate for preset/time baseline. |

This is intentionally not a broad fuzzing pass. If these candidates do not return to time/preset, the open question should be narrowed rather than expanded into unbounded command probing.

`npm run probe -- release [text] [--delay=5000]`

Finite sequence:

```text
1. Show visible remote custom text through the known `cmd 11 off -> cmd 9 custom -> cmd 29` sequence.
2. Re-enable lyric display only with `cmd 11 lyricSwitch=1`.
3. Try the bounded baseline screen-state candidates.
```

Manual observation target: distinguish whether lyric re-enable only overlays remote text while lyrics are active, whether no-music/no-lyric state still falls back to the remote custom text, and whether any `cmd 9` candidate clears that remote baseline in favor of time/preset.

Important process note: do not use fast multi-step matrix probes for final visible conclusions. They are useful for command smoke tests only. For actual observation, use `restore-step` so one action can be observed long enough before the next action.

`npm run probe -- restore-step <action> [text]`

Single-action probe for careful manual observation:

| Action | Effect |
| --- | --- |
| `read` | Read custom-text and lyric states only. |
| `lyric-on` | Send only `cmd 11 lyricSwitch=1`. |
| `lyric-off` | Send only `cmd 11 lyricSwitch=0`. |
| `remote-text [text]` | Deliberately take over custom-text foreground with one text. |
| `known-custom-text` / `candidate-mode-0` / `candidate-mode-1` / `candidate-mode-2` / `candidate-mode-4` | Send exactly one `cmd 9` screen-state candidate. |

Related manual observation: in lyric mode, a prolonged no-lyric section can return to the previous baseline mode by itself. For restore probing, this means `cmd 11 lyricSwitch=1` may restore lyrics only while the lyric stream has active lines; if the baseline underneath is still remote custom text, the device may later fall back to that remote text when lyrics go idle.

### Restore observation template

| Date | Probe | Step label | Command | Payload | Manual setup | Visible result | Readback | Conclusion | Recovery |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | restore-lyric / restore-state / release |  | `cmd 11` / `cmd 9` / `cmd 29` |  | music playing / no music / lyrics available | lyric resumed / time shown / remote text remains / unclear |  |  | known custom text / lyric on |

### 2026-05-28 restore-probe implementation and command-run notes

The local probe script now supports `restore-lyric`, `restore-state`, and `release`. At implementation time these commands were verified at the CLI/help and automated-test level.

Command runs on 2026-05-28:

| Probe | Command result | Readback result | Visible result |
| --- | --- | --- | --- |
| `restore-lyric` | Three `cmd 11` writes succeeded. | Lyric readback switched `lyricSwitch` from `1 -> 0 -> 1`. | Needs manual screen confirmation: whether final script-level re-enable resumed current lyrics. |
| `restore-state` | `cmd 9` payloads for known custom text and candidates `0/1/2/4` all wrote successfully. | `cmd 7` still reported the current custom-text cache; `cmd 2` still reported lyric switch on. | Needs manual screen confirmation: whether any candidate visibly returned to time/preset. Readback alone does not prove baseline mode. |
| `release` | Remote custom text write, lyric re-enable, candidate `cmd 9` writes, and recovery write all succeeded. | Lyric re-enable readback reported lyric switch on. | Needs manual screen confirmation: whether lyric overlay covered remote text, and whether no-lyric gaps or candidates exposed/cleared the remote baseline. |

Observed during the first mixed `release` run: after the probe wrote a custom text containing `release`, active lyrics could appear again, but after a while the screen returned to the `release` custom text, then later lyrics appeared again. This is consistent with lyric mode acting as an overlay above the baseline: active lyric lines can cover remote custom text, but the remote custom text remains the baseline underneath and can reappear during lyric gaps or timing transitions. This mixed run is not sufficient to identify the correct `cmd 9` baseline payload because too many actions were sent back-to-back.

### Joint observation plan

Use only `restore-step` commands for final conclusions. Each test should pause long enough for the observer to say what the physical screen did before the next command is sent.

| Test | Setup | Command(s) | Observe | Decision this answers |
| --- | --- | --- | --- | --- |
| Lyric switch check | Play a song with visible lyrics. | `restore-step lyric-off`, then after observation `restore-step lyric-on`. | While off: what baseline appears? After on: do current lyrics resume? | Confirms script-level lyric switch behavior. |
| Remote baseline check | Start from normal lyric playback. | `restore-step remote-text "REMOTE BASE"`, then `restore-step lyric-on`. | During active lyrics and during a no-lyric/transition gap, does `REMOTE BASE` remain underneath? | Confirms whether lyric-on alone releases remote takeover. |
| Baseline candidate check | Start from visible `REMOTE BASE`. | One at a time: `restore-step candidate-mode-0`, `candidate-mode-1`, `candidate-mode-2`, `candidate-mode-4`. | Does any candidate show time/preset, or does remote text/lyric overlay remain? | Finds or rejects the current bounded `cmd 9` baseline candidates. |

### 2026-05-28 joint restore observations

Source: user observed the physical K20 GT screen while commands were sent one step at a time.

| Test | Result | Conclusion |
| --- | --- | --- |
| Lyric switch off: `restore-step lyric-off` | Screen showed the previous custom text containing `release`; after about 30 seconds it did not automatically return to lyrics. | Turning lyric switch off exposes the underlying baseline. In this run the baseline was still the remote/custom text left by earlier probing. |
| Lyric switch on: `restore-step lyric-on` | Lyrics resumed. | Script-level `cmd 11 lyricSwitch=1` is a valid candidate for restoring lyric overlay when lyrics are available. |
| Remote baseline check, active lyrics | After `remote-text "REMOTE BASE"` and `lyric-on`, active lyrics covered `REMOTE BASE`. | Lyric overlay can cover the remote custom-text baseline. |
| Remote baseline check, lyric/no-lyric transition | `REMOTE BASE` became visible again during a gap/transition. | Re-enabling lyrics does not clear the remote custom-text baseline; it only overlays it while lyrics are active. |
| Baseline candidates: `candidate-mode-0/1/2/4` | Starting from visible `REMOTE BASE`, all four candidates produced no visible change; screen continued to show `REMOTE BASE`. | The current bounded `cmd 9` final-byte candidate matrix did not find the time/preset baseline restore command. |

Current recommendation for the later receiver restore sequence is therefore conservative:

```text
If another remote sticky exists:
  write that sticky through the existing visible custom-text sequence.
Else:
  stop remote writes.
  re-enable lyric display with cmd 11 lyricSwitch=1.
  if a baseline/time cmd 9 candidate is confirmed, also switch to that baseline state.
```

Do not yet claim that lyric re-enable alone releases remote takeover. It can restore an active lyric overlay, but the baseline underneath still matters because lyric mode can auto-return to baseline during long no-lyric gaps. Do not claim that the receiver can restore the official custom-text content or reliably return to time/preset until `restore-state` / `release` physical observations identify the correct payload.

Updated conclusion from joint observation: `cmd 11 lyricSwitch=1` can restore the lyric overlay, but it is insufficient as a release strategy because remote custom text remains underneath. The early `cmd 9` candidates `[...,0]`, `[...,1]`, `[...,2]`, and `[...,4]` did not restore time/preset because they kept the wrong `mode/curTheme` values. The official-code-derived `cmd 9` payload `[1,112,241,142,0,0,2]` successfully restores the observed preset baseline.

### Official client baseline replacement clue

User observation on 2026-05-28: while `REMOTE BASE` was left as the remote custom-text baseline, manually operating the official MCHOSE HUB client and setting a preset/custom display text replaced `REMOTE BASE`. This means the official client has a command sequence that can replace or reselect the baseline display state that remote writes are occupying.

This belongs in `probe-display-restore-mode`: the remaining useful work is to capture or derive that official operation's HID sequence, not to blindly expand the `cmd 9` candidate matrix.

Safe capture constraints:

- Do not modify files under `E:\M-HUB\MCHOSE HUB`.
- Existing extracted renderer code contains a disabled WebHID logger (`shouldEnableHidHook(){return false}` in the unpacked renderer bundle), which is a clue for a possible safe DevTools/runtime monkeypatch or copied-app investigation, but the installed official client directory must remain untouched.
- If a HID send log is captured, decode it into report id, packet command, payload bytes, and visible result before replaying anything.
- Capture steps are documented in `docs/official-client-hid-capture.md`.

Pending capture target:

| Official operation | Expected visible effect | Capture goal | Replay goal |
| --- | --- | --- | --- |
| In MCHOSE HUB, set a preset/custom display text that replaces `REMOTE BASE` | `REMOTE BASE` disappears and official-selected baseline appears | Capture report `188` writes around the operation | Reproduce the baseline replacement with one safe script step |

Code-derived clue from extracted official renderer:

```text
setScreenState payload = [screenSwitch, color[1], color[0], color[2], mode, curTheme, index]
```

The official parser maps incoming payload back as:

```text
screenSwitch = payload[0]
color = [payload[2], payload[1], payload[3]]
mode = payload[4]
curTheme = payload[5]
index = payload[6]
```

This explains why the first `cmd 9` matrix missed: it held `mode=1` and `curTheme=4` constant and only varied `index`.

From the user's official-client state screenshot:

```text
screenSwitch=1
color=[241,112,142]
mode=0
curTheme=0
index=2
```

The corresponding replay candidate is:

```text
cmd 9 payload [1,112,241,142,0,0,2]
```

This has been added to `k20gt-probe.js` as `restore-step official-preset-observed`.

Joint replay result on 2026-05-28: from visible `REMOTE BASE`, running `restore-step official-preset-observed` successfully replaced the remote custom-text baseline and returned to the official preset/baseline selected in MCHOSE HUB.

Confirmed baseline restore candidate:

```text
cmd 9 payload [1,112,241,142,0,0,2]
```

Important generalization: this exact payload restores the specific observed official preset state (`screenSwitch=1`, `color=[241,112,142]`, `mode=0`, `curTheme=0`, `index=2`). A later receiver implementation should prefer restoring a captured/current `screenState` snapshot when available, rather than hard-coding this one preset forever.

### Receiver restore implementation

OpenSpec change `add-receiver-display-restore` connects the confirmed restore candidate to the local receiver.

Recommended receiver restore sequence when the server has no remote target after a remote message:

```text
1. cmd 9 payload [1,112,241,142,0,0,2] or configured RECEIVER_RESTORE_SCREEN_STATE
2. cmd 11 lyricSwitch=1 scroll=1 text=""
```

The receiver writes the screen-state payload first so the remote custom-text baseline is replaced before lyrics are re-enabled. Lyric restore only turns the lyric switch back on; it does not preserve or replay lyric text. If a remote sticky still exists, the receiver writes that sticky instead of restoring the baseline.

The fallback payload is configurable and may be disabled because it represents one observed official preset state, not a general promise to restore the user's previous official custom-text content.

## Probe observation template

Use one row per visible observation. HID write success alone is not enough; the visible screen result is the source of truth for product decisions.

| Date | Probe | Input category | Input text | Chars | UTF-8 bytes | Payload bytes sent | Parameters | Command sequence | Write/readback result | Visible result | Conclusion | Recovery |
| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- |
| YYYY-MM-DD | baseline / length / params / segment / layer | ASCII / Chinese / emoji / mixed |  |  |  |  | `testType=1 align=1 scroll=1` | `cmd 11 -> cmd 9 -> cmd 29` |  | visible / cached-only / truncated / scroll / failed |  | known-good short write |

## Observations

### 2026-05-27 `npm run probe -- length`

Source: user-recorded video timeline without terminal captured in the same frame. Mapping is inferred from the fixed sample order in `k20gt-probe.js`; conclusions below separate observed screen behavior from script-side truncation.

| Approx. video time | Sample | Input category | Chars | UTF-8 bytes | Payload bytes sent | Script truncation | Visible result | Conclusion |
| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |
| 16s | `short`: `K20GT probe` | ASCII baseline | 11 | 11 | 11 | No | `K20GT PROBE` appears | Baseline visible custom text works. |
| 18-19s | `ascii32`: `ABCDEFGHIJKLMNOPQRSTUVWXYZ123456` | ASCII near official 32-character limit | 32 | 32 | 32 | No | Starts as `ABC...`, behaves like marquee, does not finish before next write | 32 ASCII chars are accepted and visible, but need longer dwell time to judge full readability. |
| 19-21s | `ascii52`: 52 ASCII letters | ASCII around 51-byte payload limit | 52 | 52 | 51 | Yes, to 51 ASCII bytes | Starts as `ABC...`, then next sample appears | Over-limit ASCII is truncated before write; visible path still accepts the payload and scrolls/attempts marquee. |
| 21s | `chinese16`: `今天别熬夜明天也要开心呀` | Chinese below 51-byte payload | 12 | 36 | 36 | No | Starts with `今天...` | Short Chinese custom text is visible. |
| 22-23s | `chinese20`: `今天别熬夜明天也要开心呀记得喝水` | Chinese near 51-byte payload | 16 | 48 | 48 | No | Starts with `今天...`, does not finish before next write | 16 Chinese chars / 48 bytes are accepted and visible, but default dwell time is too short for full marquee completion. |
| 25s | `emoji`: `晚安🌙今天也辛苦了✨` | Emoji/mixed UTF-8 | 10 | 31 | 31 | No | Starts with `晚安今天...`; no garbling reported | Emoji-containing text is accepted; visible emoji rendering needs a closer still/video check. |
| 27s | `mixed`: `K20GT 今天别熬夜 ok 🌙 123` | Mixed ASCII/Chinese/emoji | 20 | 33 | 33 | No | Starts with `K20 今天...` | Mixed text is accepted and visible. |
| 28-40s | `long`: long Chinese sentence | Chinese over 51-byte payload | 39 | 117 | 48 | Yes, to `这是一条用于测试长文本分段显示的` | User reports it remains visible until around 40s and can display through the truncated payload | Over-limit Chinese is truncated before write to 16 complete Chinese chars; the visible screen can scroll/display that payload if not interrupted. |
| 41s, 52s | repeated `这是一条...分段显示的` | Uncertain/repeated long payload | Unknown | Unknown | Unknown | Unknown | Similar text appears again, described as segmented/repeated | This may be device marquee repeat, video timing, or another probe run; needs a dedicated `segment` probe before counting as segmentation evidence. |

Practical length-boundary notes from this run:

- Protocol/write-side boundary remains the script's safe `cmd 29` payload cap of about 51 UTF-8 bytes.
- Visible usability is not the same as payload acceptance: with `scroll=1`, long visible lines may need substantially more than 1.8 seconds to finish.
- First-version remote messages should not assume the official 32-character UI cap is the true lower-level limit. A safer current product fallback is 51 UTF-8 bytes per `cmd 29` write, with a shorter UX copy limit or longer dwell time for readable scrolling.
- A dedicated parameter/dwell probe should test whether `scroll=1` is required for marquee behavior and what dwell time makes 32 ASCII / 48-byte Chinese readable.

### 2026-05-28 `npm run probe -- params "K20GT 参数测试"`

Source: direct user observation. This run used the original unlabeled parameter matrix, so it confirms that parameters visibly affect behavior but does not yet map every value to a precise effect.

| Probe | Input | Parameters | Visible result | Conclusion |
| --- | --- | --- | --- | --- |
| `params` | `K20GT 参数测试` | Matrix: default, `align=0`, `align=2`, `scroll=0`, `scroll=2`, `testType=0`, `testType=2` | Text appeared several times moving right-to-left, several times moving left-to-right, and once fixed in the center. | `cmd 29` parameters do affect direction/fixed display. Need labeled rerun to map exact values. |

Follow-up: `k20gt-probe.js params` now prefixes each visible text with labels like `p1-default`, `p2-align-0`, and `p5-scroll-2` so the exact parameter effects can be recorded.

### 2026-05-28 `npm run probe -- params "K20GT 参数测试"` labeled rerun

Source: direct user observation. The rerun used screen labels added to `k20gt-probe.js`.

| Label | Parameters | Visible result | Conclusion |
| --- | --- | --- | --- |
| `p1-default` | `testType=1 align=1 scroll=1` | Moves right-to-left; did not finish before next item. | Default visible custom text scrolls right-to-left. |
| `p2-align-0` | `testType=1 align=0 scroll=1` | Moves right-to-left; did not finish before next item. | `align=0` did not visibly change direction for this short matrix text. |
| `p3-align-2` | `testType=1 align=2 scroll=1` | Moves right-to-left; did not finish before next item. | `align=2` did not visibly change direction for this short matrix text. |
| `p4-scroll-0` | `testType=1 align=1 scroll=0` | Moves left-to-right. | `scroll=0` changes direction to left-to-right. |
| `p5-scroll-2` | `testType=1 align=1 scroll=2` | Moves left-to-right. | `scroll=2` also behaves left-to-right in this test. |
| `p6-testType-0` | `testType=0 align=1 scroll=1` | Appears from the left then fixes in the center. | `testType=0` produces a fixed centered display state. |
| `p7-testType-2` | `testType=2 align=1 scroll=1` | Fixed centered display. | `testType=2` also produces fixed centered display. |

### 2026-05-28 `npm run probe -- dwell "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456" -- --delay=6000`

Source: direct user observation. The 32-character ASCII input is below the 51-byte payload limit and is not truncated.

| Case | Input | Parameters | Visible result | Conclusion |
| --- | --- | --- | --- | --- |
| `scroll-0` / `scroll-1` / `scroll-2` | `ABCDEFGHIJKLMNOPQRSTUVWXYZ123456` | `testType=1 align=1 scroll=0/1/2`, 6 s dwell | User observed left-to-right, right-to-left, and finally left-to-right looping behavior. | Longer dwell confirms marquee/looping behavior and direction changes. Six seconds is more useful than 1.8 s, but still not a polished long-message experience by itself. |

### 2026-05-28 `npm run probe -- segment "这是一条用于观察分段显示的长消息，请看看读起来是否顺。" -- --delay=5000`

Source: direct user observation. The input is 27 Chinese characters / 81 UTF-8 bytes; segmentation by 51-byte chunks yields a first segment of 16 Chinese characters / 48 bytes, then a shorter second segment.

| Strategy | Visible result | Conclusion |
| --- | --- | --- |
| Finite segmented `cmd 29` writes with 5 s dwell | First segment moves right-to-left, then before it fully finishes the next shorter segment appears. The shorter segment then loops. | Segmentation works technically, but the reading experience is not smooth enough to be the default first-version long-text strategy. It is acceptable only as an experimental fallback with conservative dwell and interruption rules. |

### 2026-05-28 `npm run probe -- layer`

Source: direct user observation. The layer probe performs: known-good visible custom text, lyric state on with text, cache-only `cmd 29`, then known-good visible recovery.

| Step | Visible result | Conclusion |
| --- | --- | --- |
| Known-good visible custom text | Custom text appears. | Recovery baseline works. |
| Lyric state on with text | User did not observe a distinct lyric-layer advantage; visible custom text remained the main observable behavior. | No evidence yet that `cmd 11` is better than `cmd 29` for remote long text. |
| Cache-only `cmd 29` while lyric step has run | `不切前台` was observed as part of the sequence, but the layer interaction was not visually clear. | `cmd 29` cache-only/foreground distinction remains real but this run is not precise enough to map all layer priority states. |
| Known-good recovery | Final custom text loops/continues visibly. | The known sequence can restore visible custom text after layer experiments. |

Safe display assumption from this layer run: a future receiver should continue to disable lyric display before writing remote custom text. Preserve/restore lyric display should be treated as a later UX feature, likely behind pause/do-not-disturb or an explicit lyric-aware mode.

## Current product display recommendation

- First-version remote delivery should use `cmd 29` custom text, not the lyric path.
- Use a conservative product copy limit by default. The technical payload limit is about 51 UTF-8 bytes, but readable UX may need a shorter UI limit or a longer dwell time for scrolling text.
- For `sticky`, prefer short text that can loop without feeling like an interrupted notification.
- For `transient`, prefer short text and avoid queuing many long scrolling items back-to-back.
- Do not make segmented long text the default. Keep it as an experimental fallback until segment dwell, interruption, and restore behavior feel intentional.

## Probe plan

### Length boundary samples

- Baseline below official UI limit: short ASCII and short Chinese text.
- Around 32 visible characters: ASCII 32 characters, Chinese near 32 characters, and mixed text.
- Around about 51 UTF-8 bytes: ASCII 51/52 bytes, Chinese text near 48/51/54 bytes, emoji/mixed text that forces truncation at code-point boundaries.

Record whether the over-limit text is rejected, truncated before write by the script, accepted into device cache, visibly truncated, scrolls, or fails to foreground.

### Bounded `cmd 29` parameter matrix

Known-good default:

```text
testType=1, align=1, scroll=1
```

Initial bounded candidates:

```text
testType: 0, 1, 2
align: 0, 1, 2
scroll: 0, 1, 2
```

Do not fuzz the full Cartesian product at first. Use the finite probe matrix in `k20gt-probe.js`: vary one field around the known-good default, then repeat only promising combinations with near-boundary text.

### Long-text strategy probes

- Conservative segmentation: split by UTF-8 byte length, show each segment for about 1.8 seconds, and return to a known-good short write afterward.
- Timed refresh: compare whether segment transitions feel readable enough for `transient` messages.
- Scroll candidates: repeat promising `scroll` values with near-boundary text before considering any longer product behavior.

### Lyric/custom layer probes

- Start with lyric display off, switch to custom-text state, then write `cmd 29`.
- Compare custom text after lyric display on/off order changes.
- Record whether `cmd 29` updates only cache while the lyric layer remains visible.
- Recover with the known visible custom-text sequence after each layer group.
