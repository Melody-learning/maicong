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
- 仅发送 `cmd 29` 会更新自定义文字缓存，但不一定立刻在屏幕前台显示。
- 实测要稳定前台显示自定义文字，需要先关闭歌词显示层，再切到自定义文字相关屏幕状态，然后发送 `cmd 29`。
- 当前已存在最小脚本 `k20gt-screen.js`，可通过命令把文本发送到音响屏幕；底层写屏逻辑已抽到 `lib/k20gt-screen-writer.js` 供 CLI 和 receiver 复用。
- 当前已存在第一版本地 receiver `k20gt-receiver.js`，可主动轮询远程 API、写屏并在写屏成功后 ack。
- 当前已存在本地有限探测脚本 `k20gt-probe.js`，用于长文本、参数矩阵和分段显示的人工观察记录。

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
- `openspec/`：后续需求稳定后，用于记录正式变更、设计和规格。

## 当前迭代进度

- 已完成本地 HID 写屏最小验证，确认 `k20gt-screen.js` 可直接写入 K20 GT 屏幕。
- 正在执行 OpenSpec change `probe-long-text-display`，当前已完成本地有限探测脚本、观察记录模板和第一轮 `length` 视频观察记录。
- 已确定第一版产品抽象：底层为屏幕消息投递，产品层先包装为 `sticky`（贴上去）和 `transient`（显示一下）。
- 已确定第一版远程验证方向：Vercel + 轻量 Redis/KV + 本地 Node receiver 轮询。
- 由于暂时不方便继续设备验证，OpenSpec change `add-remote-message-api` 已实现并归档第一版云端消息 API：Vercel `api/` 函数结构、Upstash Redis 存储抽象、sticky/transient 状态机、token、TTL、限频、短队列上限、ack 和 clear；本 change 不包含网页发送 UI 或长文本显示实验。
- OpenSpec change `add-local-message-receiver` 已实现第一版本地 Node.js receiver：从环境变量读取远程 API 地址和 receiver token，按间隔轮询 `next`，有消息时复用 HID 写屏模块，写屏成功后 ack；API/JSON/ack/写屏失败不会让循环崩溃，Ctrl+C 可退出。本 change 不包含托盘、暂停/勿扰、自启动、Windows 服务或发送 UI。
- OpenSpec change `prepare-vercel-github-deployment` 已完成并归档第一版提交部署准备：补齐 `.gitignore`、`.env.example`、GitHub + Vercel + Upstash Redis 手动部署文档、线上 API smoke test 和 receiver 联调步骤。
- 2026-05-27 已完成真实线上闭环验证：GitHub 仓库已连接 Vercel，Upstash Redis 通过 Vercel KV 兼容环境变量工作，线上 API 可创建/拉取/ack/clear 消息，本地 receiver 已连接生产 Vercel API 并把远程 transient 消息显示到真实 `MCHOSE K20 GT` 屏幕。
- `probe-long-text-display` 后续继续探测长文本、滚动、歌词层和自定义文字层边界；远程 API 按保守可配置文本限制推进。
- 后续仍需观察 receiver 在实际长期设备/网络环境下的稳定性，并决定 Vercel Deployment Protection 是否长期保持关闭或引入自动化 bypass 方案。

建议的后续 change 顺序：

1. `probe-long-text-display`：探测超过 32 字、滚动、歌词层和自定义文字层能力边界。
2. `add-remote-message-api`：实现 Vercel API、轻量 Redis/KV 消息存储、状态机、调度和 token。（第一版已完成并归档）
3. `add-local-message-receiver`：实现本地 receiver 轮询、写屏、ack 和失败处理。（第一版已完成并归档）
4. `prepare-vercel-github-deployment`：准备 GitHub + Vercel + Upstash 手动部署材料和安全忽略规则。（第一版已完成并归档）
5. 真实线上闭环验证：GitHub -> Vercel API -> Upstash Redis -> local receiver -> K20 GT 屏幕。（已完成，见 `docs/vercel-upstash-smoke-test-report.md`）
6. `add-web-message-sender`：实现极简网页发送入口，包装“贴上去 / 显示一下”。
7. `package-receiver-experience`：补暂停/勿扰、自启动、托盘、配置文件等体验能力。

## 常用命令

```powershell
npm run screen -- "今天别熬夜"
npm run receiver
npm run probe -- help
```

用途：向已连接的 `MCHOSE K20 GT` 屏幕发送一条短文本，或启动本地 receiver 轮询远程消息。

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

- `cmd 29` 的 `testType`、`align`、`scroll` 参数分别有哪些完整取值和显示效果。
- 是否可以通过更长停留时间、滚动参数、多次刷新、分段策略、歌词层或其他模式实现超过 32 字的远程长文本体验。
- 官方歌词显示和自定义文字显示是否互相覆盖，优先级如何。
- 已知歌词显示层会影响自定义文字的可见性；远程消息场景默认应先关闭歌词层。
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
