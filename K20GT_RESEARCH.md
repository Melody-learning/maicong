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

## Useful commands

```powershell
npm run screen -- "晚安，今天也辛苦了"
npm run receiver
npm run probe -- help
npm run probe -- send "K20GT probe" -- --testType=1 --align=1 --scroll=1
npm run probe -- length
npm run probe -- params "K20GT 参数"
npm run probe -- segment "这是一条用于观察分段显示的长消息"
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
