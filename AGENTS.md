# AGENTS.md

## 项目背景

这是一个围绕迈从 `MCHOSE K20 GT` 蓝牙/USB 音响屏幕能力的探索项目。初始目标不是替代官方客户端，而是把“屏幕显示自定义文本”这件事扩展成可编程、可远程投递、可结合声音的桌面互动能力。

当前最有价值的产品方向：

- 远程小纸条：从网页、Telegram、微信或其他入口，把短消息投递到她电脑上的 K20 GT 屏幕。
- 桌面轻提醒：日程、番茄钟、待办、重要通知，以低打扰字幕形式显示。
- 声音 + 字幕场景：提示音、TTS、白噪音、音乐氛围字幕和屏幕文本联动。

## 已确定事实

- 官方客户端为 `MCHOSE HUB`，安装路径已观察到为 `E:\M-HUB\MCHOSE HUB`。
- 目标设备为 `MCHOSE K20 GT`。
- 系统识别到的 USB ID 为 `VID_3837 / PID_60C6`。
- K20 GT 屏幕可通过 HID report `188` 写入。
- 可写端点为 `MI_03 Col01`。
- 本工作区已经用 `node-hid` 直接写入过自定义文本，并收到成功写入结果。
- 官方客户端提供“屏幕显示自定义”，文本限制为 32 个字以内。
- 底层协议中 `cmd 29` 可设置屏幕文字，文本载荷约为 51 字节 UTF-8。
- 2026-05-27 `length` 视频观察显示，`cmd 29` 默认参数下长于可视区域的文本会尝试跑马灯/滚动；但 1.8 秒默认探测间隔可能不足以完整显示一条 32 字符英文或 48 字节中文。
- 2026-05-28 参数探测显示：`scroll=1` 为从右到左，`scroll=0/2` 为从左到右，`testType=0/2` 会进入固定居中显示；`align=0/1/2` 在当前短文本测试中未观察到明显方向差异。
- 2026-05-28 分段探测显示：超过 51 字节的长中文可被拆成多次 `cmd 29` 写入，但第一段可能未完整显示就被下一段覆盖，整体阅读体验暂不适合作为第一版默认长文本策略。
- 2026-05-28 歌词层有限探测未证明 `cmd 11` 比 `cmd 29` 更适合远程长文本；第一版 receiver 仍应默认先关闭歌词显示层再写自定义文字。
- 当前对歌词层/自定义文字层的最佳理解是：二者不是简单“后写覆盖前写”，设备同时存在缓存状态和前台显示状态；歌词显示应按可能占用前台处理，不能只依赖 `cmd 29` 写入顺序。
- 仅发送 `cmd 29` 会更新自定义文字缓存，但不一定立刻在屏幕前台显示。
- 实测要稳定前台显示自定义文字，需要先关闭歌词显示层，再切到自定义文字相关屏幕状态，然后发送 `cmd 29`。
- 当前已存在最小脚本 `k20gt-screen.js`，可通过命令把文本发送到音响屏幕；底层写屏逻辑已抽到 `lib/k20gt-screen-writer.js` 供 CLI 和 receiver 复用。
- 当前已存在第一版本地 receiver `k20gt-receiver.js`，可主动轮询远程 API、写屏并在写屏成功后 ack。
- 当前已存在本地有限探测脚本 `k20gt-probe.js`，用于长文本、参数矩阵、分段显示和显示恢复序列的人工观察记录。
- 2026-05-28 `probe-display-restore-mode` 已增加脚本级恢复探测入口：`restore-lyric`、`restore-state`、`release` 和单步 `restore-step`；合测确认 `cmd 11 lyricSwitch=1` 可恢复歌词覆盖，但不会清理远程自定义文本基底。歌词关闭后会露出底下的 `release/REMOTE BASE` 文本；歌词开启后有歌词时会覆盖，歌词间隙会再次露出远程文本。
- 2026-05-28 合测确认：围绕已知自定义文字前台 payload 的 `cmd 9` 小矩阵候选 `[...,0]`、`[...,1]`、`[...,2]`、`[...,4]` 从 `REMOTE BASE` 出发均未产生可见变化，未能回到时间/个性化预设基底。
- 2026-05-28 用户手动操作官方 MCHOSE HUB 设置预设/自定义显示文本后，`REMOTE BASE` 被替换掉。这说明官方客户端存在可替换远程自定义文本基底的命令序列；`probe-display-restore-mode` 应继续用安全抓包/线索定位这条序列，而不是直接进入 receiver restore 实现。
- 2026-05-28 解包官方 renderer 确认 `cmd 9` 屏幕状态 payload 结构为 `[screenSwitch, G, R, B, mode, curTheme, index]`；官方状态解析回 `[screenSwitch, color=[R,G,B], mode, curTheme, index]`。用户截图中的状态 `screenSwitch=1 color=[241,112,142] mode=0 curTheme=0 index=2` 对应候选 payload `[1,112,241,142,0,0,2]`。合测确认 `restore-step official-preset-observed` 可从 `REMOTE BASE` 成功恢复/替换为官方预设基底。
- 2026-05-28 `add-receiver-display-restore` 已把保守恢复序列接入本地 receiver：当远程目标结束且 `/next` 返回空时，默认先写 `cmd 9` fallback preset payload `[1,112,241,142,0,0,2]`，再写 `cmd 11 lyricSwitch=1` 恢复歌词开关；若 transient 后仍有 sticky，则恢复 sticky 而不是释放基底。该逻辑可通过环境变量关闭或覆盖，不承诺恢复官方自定义文本内容。
- 2026-05-28 `add-receiver-display-controls` 已实现第一版显示控制语义：新增 receiver-only `POST /api/messages/{id}/dismiss`，sticky dismiss 映射为 `expired`，transient dismiss 映射为 `shown`；receiver 新增本地 DND 和 `receiver-control.json` 一次性控制入口，支持 dismiss、DND on/off；DND 开启时跳过 `/next`、不写屏、不 ack，若当前远程显示活跃则先执行 restore。自动检测 MCHOSE HUB 本地接管暂不实现，后续托盘/检测可复用同一 dismiss helper。
- 2026-05-28 `add-display-status-and-web-controls` 已实现第一版跨端显示状态：消息公开响应新增 `displayState`、`endedReason`、`endedAt`；API 新增 `GET/POST /api/display/status`；receiver 上报 lastSeen/DND/current display/remote active；web sender 增加状态区，可用 `SEND_TOKEN` 查看 receiver 在线近似状态、DND、当前 sticky 和 transient 队列摘要。第一版 DND 仍以 receiver 本地为权威，web 只读展示，不远程切换。

## 当前核心文件

- `k20gt-screen.js`：本地写屏幕文本的最小 Node.js CLI。
- `k20gt-receiver.js`：本地远程消息 receiver，轮询云端 API、写屏、ack。
- `lib/k20gt-screen-writer.js`：K20 GT HID 写屏共享模块。
- `lib/local-message-receiver.js`：receiver 配置、请求、单轮处理和轮询循环模块。
- `K20GT_RESEARCH.md`：协议、设备、命令和本地验证记录。
- `package.json` / `package-lock.json`：Node.js 依赖和脚本入口，目前主要依赖 `node-hid`。
- `.env.example`：云端 API 和本地 receiver 的环境变量占位示例，不包含真实 token。
- `docs/vercel-deployment.md`：GitHub + Vercel + Upstash Redis 手动部署和 smoke test 指南。
- `docs/vercel-upstash-smoke-test-report.md`：Vercel + Upstash + 本地 receiver + 真实 K20 GT 屏幕的线上闭环验证记录。
- `docs/web-message-sender.md`：第一版网页发送入口的使用、token 存储和手动验证说明。
- `docs/web-message-sender-smoke-test-report.md`：本地网页发送入口到真实 K20 GT 屏幕的 smoke test 记录。
- `public/`：Vercel 根路径网页发送入口，调用现有消息 API。
- `openspec/`：后续需求稳定后，用于记录正式变更、设计和规格。

## 当前迭代进度

- 已完成本地 HID 写屏最小验证，确认 `k20gt-screen.js` 可直接写入 K20 GT 屏幕。
- 正在执行 OpenSpec change `probe-long-text-display`，当前已完成本地有限探测脚本、观察记录模板、长度边界、参数矩阵、分段长文本和歌词层有限探测记录。
- 已确定第一版产品抽象：底层为屏幕消息投递，产品层先包装为 `sticky`（贴上去）和 `transient`（显示一下）。
- 已确定第一版远程验证方向：Vercel + 轻量 Redis/KV + 本地 Node receiver 轮询。
- 由于暂时不方便继续设备验证，OpenSpec change `add-remote-message-api` 已实现并归档第一版云端消息 API：Vercel `api/` 函数结构、Upstash Redis 存储抽象、sticky/transient 状态机、token、TTL、限频、短队列上限、ack 和 clear；本 change 不包含网页发送 UI 或长文本显示实验。
- OpenSpec change `add-local-message-receiver` 已实现第一版本地 Node.js receiver：从环境变量读取远程 API 地址和 receiver token，按间隔轮询 `next`，有消息时复用 HID 写屏模块，写屏成功后 ack；API/JSON/ack/写屏失败不会让循环崩溃，Ctrl+C 可退出。本 change 不包含托盘、暂停/勿扰、自启动、Windows 服务或发送 UI。
- OpenSpec change `prepare-vercel-github-deployment` 已完成并归档第一版提交部署准备：补齐 `.gitignore`、`.env.example`、GitHub + Vercel + Upstash Redis 手动部署文档、线上 API smoke test 和 receiver 联调步骤。
- 2026-05-27 已完成真实线上闭环验证：GitHub 仓库已连接 Vercel，Upstash Redis 通过 Vercel KV 兼容环境变量工作，线上 API 可创建/拉取/ack/clear 消息，本地 receiver 已连接生产 Vercel API 并把远程 transient 消息显示到真实 `MCHOSE K20 GT` 屏幕。
- OpenSpec change `add-web-message-sender` 已实现第一版极简网页发送入口：Vercel 根路径提供实际发送工具，用户在浏览器输入 `SEND_TOKEN` 后可发送“贴上去”/“显示一下”并清空当前 sticky；页面不要求也不暴露 `RECEIVER_TOKEN`。2026-05-28 已完成本地网页到真实 K20 GT 屏幕 smoke test：`http://localhost:3000/` -> 本地 Vercel API -> Upstash Redis -> 本地 receiver -> HID 写屏 -> K20 GT，用户手动测试网页确认可用。同日已 push 到 GitHub 并完成 Vercel production 根路径网页手动验证。本 change 不包含登录、多用户、多设备、Telegram/微信、receiver 托盘/自启动/勿扰、长文本策略、声音/TTS 或 Deployment Protection bypass。
- `probe-long-text-display` 已完成主要设备边界探测，结论是第一版远程 API/receiver 继续按保守可配置文本限制推进，默认使用 `cmd 29` 自定义文字，不默认启用分段长文本或歌词路径。
- 2026-05-28 用户在官方客户端实测确认：如果正在播放音乐，手动关闭歌词模式后再开启，设备会自动继续展示当前歌词。这说明后续 receiver 恢复歌词时不需要保存歌词文本本身，重点是恢复歌词开关状态。
- 2026-05-28 用户观察到：歌词模式开启时，如果中间长时间处于无歌词状态（例如一直是“噢噢噢”的人声段），设备会自动回到原来的基底模式。这进一步说明歌词层更像临时覆盖层，恢复歌词开关不等于清理远程自定义文本基底。
- 新的接收端显示控制主线已确定：远程投递相对 K20 GT 原生显示系统应建模为外部插入/抢占。当前已完成自然结束 restore 以及第一版 dismiss/DND 控制，暂不进入 Telegram/微信、多用户或复杂托盘包装。
- OpenSpec change `probe-display-restore-mode` 已完成并归档：新增有限恢复探测命令和文档记录框架；合测确认 `cmd 11 lyricSwitch=1` 可恢复歌词覆盖但不清理远程自定义文本基底，并确认官方状态 payload `[1,112,241,142,0,0,2]` 可从 `REMOTE BASE` 恢复/替换为官方预设基底。
- OpenSpec change `add-receiver-display-restore` 已实现：`lib/k20gt-screen-writer.js` 新增歌词开关、screen state、preset restore 和组合 restore helper；`lib/local-message-receiver.js` 新增本地显示会话状态和 restore-on-empty 规则；默认恢复配置为 `RECEIVER_RESTORE_ON_EMPTY=true`、`RECEIVER_RESTORE_LYRIC=true`、`RECEIVER_RESTORE_SCREEN_STATE=1,112,241,142,0,0,2`。单元测试覆盖 null/active、连续 null、sticky、transient 后 null、transient 后 sticky、写屏失败、restore 失败和配置解析；`npm test` 与 `openspec validate add-receiver-display-restore --strict` 已通过。
- OpenSpec change `add-receiver-display-controls` 已实现：API/storage 支持 receiver dismiss；receiver 支持 current-message dismiss、DND、本地控制文件和 restore 集成；单元测试覆盖 dismiss sticky/transient、权限边界、DND 不 poll/不写/不 ack、DND active restore、DND off 恢复展示、dismiss/restore 失败不崩溃；`npm test` 与 `openspec validate add-receiver-display-controls --strict` 已通过。
- OpenSpec change `add-display-status-and-web-controls` 已实现：云端 display status endpoint、receiver status TTL、receiver 状态上报、消息 endedReason/displayState、web 状态区域和相关文档测试；第一版不提供 web 远程切换 DND，不包含 installer/托盘/自启动。
- 后续仍需观察 receiver 在实际长期设备/网络环境下的稳定性，并决定 Vercel Deployment Protection 是否长期保持关闭或引入自动化 bypass 方案。

建议的后续 change 顺序：

1. `probe-long-text-display`：探测超过 32 字、滚动、歌词层和自定义文字层能力边界。
2. `add-remote-message-api`：实现 Vercel API、轻量 Redis/KV 消息存储、状态机、调度和 token。（第一版已完成并归档）
3. `add-local-message-receiver`：实现本地 receiver 轮询、写屏、ack 和失败处理。（第一版已完成并归档）
4. `prepare-vercel-github-deployment`：准备 GitHub + Vercel + Upstash 手动部署材料和安全忽略规则。（第一版已完成并归档）
5. 真实线上闭环验证：GitHub -> Vercel API -> Upstash Redis -> local receiver -> K20 GT 屏幕。（已完成，见 `docs/vercel-upstash-smoke-test-report.md`）
6. `add-web-message-sender`：实现极简网页发送入口，包装“贴上去 / 显示一下”。（第一版已完成）
7. `probe-display-restore-mode`：探测脚本级恢复序列，确认关闭/重新开启歌词模式可复现官方客户端行为，并寻找切回个性化预设/时间基底的 `cmd 9` 或相关命令。
8. `add-receiver-display-restore`：把恢复序列接入 receiver，使 transient 后恢复当前 sticky 或释放远程占用，用户清空/关闭长展示后恢复歌词开关并尽量回到基底模式。（第一版已完成）
9. `add-receiver-display-controls`：在 API/receiver 层提供明确的远程显示控制，例如关闭当前长展示、receiver-local DND 和恢复策略；不新增复杂账户系统。（第一版已完成）
10. `add-display-status-and-web-controls`：打通 web/API/receiver 的产品层显示状态、receiver 在线近似状态、DND 展示和消息失效原因。（第一版已完成）
11. `package-receiver-experience`：在显示占用语义稳定后，再补托盘按钮、自启动、Windows 服务/任务计划和更友好的本地配置体验。

## 常用命令

```powershell
npm run screen -- "今天别熬夜"
npm run receiver
npm run probe -- help
npm run vercel:dev
```

用途：向已连接的 `MCHOSE K20 GT` 屏幕发送一条短文本，启动本地 receiver 轮询远程消息，运行探测脚本，或启动 Vercel 本地开发服务打开网页发送入口。

## 远程投递方向

推荐的第一版架构：

```text
发送端网页 / Bot / 其他入口
        |
        v
云端消息中转服务
        |
        v
她电脑上的常驻 receiver
        |
        v
k20gt-screen.js
        |
        v
MCHOSE K20 GT 屏幕
```

关键原则：

- 她的电脑不应暴露公网端口。
- 她电脑端应主动向云端拉取消息，或主动建立长连接。
- 第一版优先网页投递，后续再接 Telegram 或微信。
- 第一版网页投递已通过 Vercel 根路径提供极简发送入口；token 由用户在浏览器输入并可本地记住。
- 接收端最终应做成托盘小程序；当前第一版已可用 Node.js 脚本验证。
- 第一版验证阶段可使用 Vercel 部署网页和 API，先解决远程投递闭环；Vercel 不作为国内长期稳定可用的最终承诺，后续可迁移到国内云、香港或新加坡节点。
- 第一版验证阶段的云端存储推荐使用 Vercel 当前支持的轻量 Redis/KV 方案（如 Vercel Marketplace 的 Upstash Redis），用于消息短队列、TTL、状态和限频。
- 2026-05-27 真实验证中，Upstash Redis 通过 Vercel Storage 自动注入的 `KV_REST_API_URL` / `KV_REST_API_TOKEN` 可被当前 API 直接使用，无需额外重复配置 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`。
- 2026-05-27 真实验证中，Vercel Deployment Protection 的登录保护会拦截 API 客户端；第一版已通过关闭 Vercel Authentication 解决，安全边界依赖 API 自身 bearer token。
- 第一版鉴权可先使用调试 token，不做注册登录；发送端 token 和 receiver token 推荐分开，避免发送 token 泄露后可伪造接收端确认。

## 消息投递产品模型

底层应以“屏幕消息投递”而不是单一“便利贴”建模：所有远程内容都可以理解为消息上传、消息展示、消息过期。

产品层可以包装成不同形式：

- `sticky`：持续目标状态，表示屏幕默认应该保持显示什么；适合远程便利贴、桌面状态、长期字幕。新的 `sticky` 默认替换旧的 `sticky`。
- `transient`：一次性展示任务，表示临时显示一下；适合轻提醒、插入消息、短通知。展示完成后结束，并恢复当前有效 `sticky`。

第一版推荐规则：

- 屏幕永远最多有一个当前有效的 `sticky`，也可以为空。
- `sticky` 允许不过期，适合天气、状态、长期字幕等持续显示内容；也应支持显式清空或被新的 `sticky` 替换。
- `transient` 优先于 `sticky` 展示。
- 多个 `transient` 使用短队列处理，按创建时间展示，但必须有 TTL，过期未展示则丢弃。
- `transient` 队列应有小上限，第一版可考虑最多 3-5 条，避免把音响屏幕变成通知收件箱。
- 不做可靠补播语义：离线太久的过期消息不应在 receiver 恢复后集中播放。
- 用户界面不必暴露底层术语，可包装成“贴上去”和“显示一下”两种发送意图。

第一版消息状态和调度：

- 消息状态保持简单：`pending`、`showing`、`shown`、`expired`。
- `transient` 通常是 `pending -> showing -> shown`，或未展示前过期进入 `expired`。
- `sticky` 通常是 `pending -> showing -> expired`；receiver 确认显示后仍保持当前目标状态，不因为 ack 进入 `shown`。
- 服务端调度规则优先级：`pending transient` 按创建时间 FIFO 展示，其次返回当前有效 `sticky`，最后为空。
- API 边界可先保持为：创建消息、拉取下一条、确认展示、清空当前 `sticky`。
- 没有当前消息时，receiver 第一版默认不主动改写屏幕，减少对设备原有显示状态的打扰。

需要注意：K20 GT 本身已有官方显示模式/显示队列（例如歌词层、自定义文字层等），远程投递层本质上是在占用和调度既有显示能力；实现时应尽量可恢复、可暂停，避免长期抢占不可控。

当前对屏幕显示层的产品模型：

- K20 GT 原生层大致可理解为“基底模式 + 歌词临时覆盖”：基底模式包括个性化预设/时间等和自定义文本；歌词模式开启后，在有歌曲歌词时会临时覆盖基底，歌词结束或无歌词时回到基底。
- 歌词模式在长时间无歌词段会自动释放回基底模式，因此 receiver 释放远程占用时不能只依赖“重新开启歌词覆盖”，仍需要尽量恢复正确基底。
- 远程投递无论内部叫 `sticky` 还是 `transient`，相对设备原生显示系统都应视为外部插入/抢占。
- `sticky` 表示远程系统希望持续占用的目标文字，不等同于设备原生基底模式。
- `transient` 表示临时插入；显示结束后应优先恢复当前远程 `sticky`，若无 sticky，则释放远程占用并恢复歌词开关/基底模式。
- 已确认重新开启歌词模式后，正在播放的歌词可由设备/官方链路自动续上；后续重点是复现歌词开关命令和寻找回到个性化预设/时间基底的命令。
- 当前 receiver 的释放顺序为先恢复配置的 `cmd 9` 基底 payload，再开启歌词开关；这是为了避免只开启歌词时在无歌词间隙露出远程文本。
- 当前跨端显示状态为产品层摘要，不等同于 K20 GT 原生显示层。公开消息使用 `displayState`/`endedReason` 区分 active/showing/shown/dismissed/expired/replaced/cleared；receiver 上报的 DND 是本地权威状态，web sender 仅展示，不远程修改。

## 安全和体验约束

- 必须有发送 token 或密码，避免陌生人投递。
- 必须限制消息长度，避免刷屏或协议异常；但不应过早把产品能力固定在官方 UI 的 32 字限制内，应继续探测底层 UTF-8 载荷、拼接刷新、滚动和歌词显示等长文本方案，必要时用 32 字作为兜底。
- 必须限频，避免刷屏。
- 她电脑端需要暂停/勿扰能力。
- 远程消息应有已读/已显示状态，避免重复显示。
- 不做绕过付费服务、攻击他人设备、传播恶意控制工具的能力。

## 应持续记录的核心内容

每次探索或确认后，优先更新以下内容：

- 设备事实：VID/PID、端点、report、命令、限制。
- 用户体验事实：官方客户端已有能力、UI 限制、实际显示效果。
- 产品决策：第一版做什么、不做什么、为什么。
- 架构决策：远程通道、云端存储、receiver 运行方式。
- 安全决策：鉴权、限频、暂停、隐私边界。
- 未解决问题：需要实验验证的协议、网络、打包和自启动问题。

## 当前开放问题

- `cmd 29` 参数已完成第一轮有限映射；仍可后续细测 `align` 在不同长度、不同 `testType` 下是否影响位置。
- 分段长文本技术上可行但体验不理想；后续若要做长文本，应重新设计停留时间、打断恢复和 UI 文案限制。
- 官方歌词显示和自定义文字显示的完整优先级仍未完全枚举；第一版远程消息场景默认应先关闭歌词层。
- 当前已确认歌词恢复开关和一个官方预设基底恢复命令；`add-receiver-display-restore` 第一版已使用 fallback preset payload，后续更理想的是在 receiver 启动或写远程消息前保存/恢复当前 `screenState` 快照。
- 后续恢复探测仍应使用 `restore-step` 单步执行和记录，避免连续矩阵把歌词时序、基底状态和 recovery 写入混在一起。
- 图片上传协议能否稳定用于自定义图案或像素动画。
- receiver 第一版已采用 Node.js 脚本；后续仍需决定正式体验采用 Electron 托盘、Windows 服务、还是其他打包方式。
- 微信入口是否使用正规公众号/企业微信/网页跳转，还是只作为后期探索。
- Vercel + Upstash Redis 已完成首次线上到设备闭环验证；仍需观察长期运行和她实际网络环境下的稳定性，若不稳定，需迁移到国内云、香港或新加坡节点。

## 工作方式

- 初期以探索和小步验证为主，事实比大设计更重要。
- 新功能进入实现前，优先用 OpenSpec 写清楚目标、范围、设计和验收标准。
- 每次创建 OpenSpec change 前，必须先检查本文件的“当前迭代进度”和相关决策，确保 change 没有偏离最新共识。
- 每个 OpenSpec change 完成或关键探索确认后，应及时更新本文件中的迭代进度、产品/架构决策和开放问题，保持简洁真实。
- 不要随意改官方客户端安装目录。
- 对音响的写入应尽量可恢复、可暂停、可退出。
- 文档内容可以少，但必须真实、可追溯、方便下一次继续。
