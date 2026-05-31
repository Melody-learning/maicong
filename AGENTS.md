# AGENTS.md

## 项目定位

这是围绕迈从 `MCHOSE K20 GT` 蓝牙/USB 音响屏幕能力的探索项目。当前目标不是替代官方客户端，而是把“屏幕显示自定义文本”扩展成可编程、可远程投递、可恢复、可暂停的桌面互动能力。

最有价值的产品方向：

- 远程小纸条：从网页、Bot 或其他入口，把短消息投递到她电脑上的 K20 GT 屏幕。
- 桌面轻提醒：日程、番茄钟、待办、重要通知，以低打扰字幕形式显示。
- 声音 + 字幕场景：提示音、TTS、白噪音、音乐氛围字幕和屏幕文本联动。

## 当前状态

- 当前产品抽象是一个会过期的远程“小黑板” board：云端最多维护一个当前 board，新 board 替换旧 board，每个 board 必须有 `durationSeconds` / `expiresAt`。
- 公开 API 已切到 `POST/GET/DELETE /api/board`、`POST /api/board/{id}/displayed`、`POST /api/board/{id}/dismiss`、`GET /api/board/history`；旧 `/api/messages` 路由只保留 410 退役响应。
- 网页发送入口位于 `public/`，根路径提供“写到小黑板”、清空、状态刷新和最近小黑板历史。
- 本地 receiver 已支持轮询 board、写屏、上报 displayed、DND、dismiss、restore、本地配置文件、Windows 后台脚本、登录自启动和私有预配置 bundle。
- 当前 OpenSpec 没有 active change；已归档的变更和规范在 `openspec/changes/archive/` 与 `openspec/specs/`。
- 最近验证：`npm test` 通过，`openspec validate --specs --strict` 通过。`simplify-remote-display-to-expiring-board` 及后续历史视图主要通过自动化测试和 mocked HID 验证，尚未重新做真实 K20 GT 长期运行验证。

## 关键事实

- 官方客户端为 `MCHOSE HUB`，已观察安装路径为 `E:\M-HUB\MCHOSE HUB`。
- 目标设备为 `MCHOSE K20 GT`；USB ID 为 `VID_3837 / PID_60C6`。
- 屏幕可通过 HID report `188` 写入；可写端点为 `MI_03 Col01`。
- `cmd 29` 可设置屏幕文字，文本载荷约为 51 字节 UTF-8；官方 UI 文本限制为 32 字以内。
- 稳定前台显示自定义文字的已知序列：关闭歌词层，切到自定义文字相关 screen state，再发送 `cmd 29`。
- receiver 释放远程占用的默认恢复序列：先写 `cmd 9` fallback preset payload `[1,112,241,142,0,0,2]`，再写 `cmd 11 lyricSwitch=1`。
- 歌词层更像临时覆盖层；只重新打开歌词不能保证清理远程自定义文本基底。

协议和探测细节集中记录在 `K20GT_RESEARCH.md`，不要把新的底层观察大量堆回本文件。

## 架构

```text
发送端网页 / Bot / 其他入口
        |
        v
Vercel API + Upstash Redis/KV
        |
        v
她电脑上的本地 receiver
        |
        v
K20 GT HID screen writer
        |
        v
MCHOSE K20 GT 屏幕
```

关键原则：

- 她的电脑不暴露公网端口；本地 receiver 主动向云端拉取。
- 第一版优先网页投递，后续再探索 Telegram、微信或其他入口。
- 发送 token 和 receiver token 分开；发送端不暴露 `RECEIVER_TOKEN`。
- Vercel + Upstash 是第一版远程闭环方案，不承诺国内长期稳定；必要时迁移到国内云、香港或新加坡节点。

## 当前 Board 模型

- 云端最多一个当前有效 board，也可以为空。
- 创建 board 必须提供 `text` 和 `durationSeconds`。
- 新 board 默认替换旧 board；旧 board 记录为 `replaced`。
- 发送端清空当前 board 时记录为 `cleared`。
- receiver 本地 dismiss 当前 board 时记录为 `dismissed`。
- 到期 board 在读取时清理 current pointer，记录为 `expired`，并返回 `board: null`。
- receiver 只在 board id 变化时写屏；同一 active board id 不重复写 HID、不重复上报 displayed。
- 没有当前 board 时，若此前有远程占用，receiver 按配置 restore 一次；若没有远程占用，则不改写屏幕。
- 最近历史是 bounded recent-write index，不是通知收件箱、可靠队列、审计日志或永久归档。

## 文件地图

- `k20gt-screen.js`：本地写屏最小 CLI。
- `k20gt-probe.js`：设备协议和显示恢复探测 CLI。
- `k20gt-receiver.js`：本地 receiver 启动入口。
- `k20gt-receiver-control.js`：本地 receiver 控制 CLI，用于 status、DND、dismiss、restore。
- `lib/k20gt-screen-writer.js`：K20 GT HID 写屏共享模块。
- `lib/local-message-receiver.js`：receiver 配置、轮询、写屏、状态上报和控制逻辑。
- `lib/remote-message/`：board API、Redis 存储、模型、配置和校验。
- `lib/receiver-windows-runtime.js`：Windows 后台运行、自启动、日志和 PID 管理。
- `lib/receiver-bundle.js` / `scripts/prepare-receiver-bundle.js`：私有预配置 Windows receiver bundle 生成逻辑。
- `api/`：Vercel serverless API 路由。
- `public/`：网页发送入口。
- `scripts/windows/`：Windows receiver 安装、启动、停止、状态、自启动脚本。
- `tests/`：Vitest 覆盖 API、存储、receiver、web、bundle 和 Windows runtime。
- `docs/`：部署、receiver、web、验证报告和设计说明。
- `openspec/`：已归档变更、当前规范和后续正式变更入口。

## 重要文档

- `K20GT_RESEARCH.md`：设备事实、HID 协议、探测命令、显示层和恢复序列。
- `docs/remote-message-api.md`：当前 board API 合约。
- `docs/local-message-receiver.md`：本地 receiver 配置、命令、运行行为和 bundle 生成。
- `docs/web-message-sender.md`：网页发送入口行为和手动检查。
- `docs/vercel-deployment.md`：Vercel + Upstash 部署和 smoke test。
- `docs/expiring-board-verification.md`：board 模型自动化验证范围。
- `docs/project-history.md`：里程碑、已退役模型和历史资料索引。
- `docs/receiver-display-ownership-and-controls-report.md`：显示占用、dismiss、DND 和 restore 的产品模型背景。

## 常用命令

```powershell
npm run screen -- "今天别熬夜"
npm run receiver
npm run receiver:install
npm run receiver:start
npm run receiver:runtime:status
npm run receiver:stop
npm run receiver:autostart:on
npm run receiver:autostart:off
npm run receiver:status
npm run receiver:dnd:on
npm run receiver:dnd:off
npm run receiver:dismiss
npm run receiver:restore
npm run receiver:bundle
npm run probe -- help
npm run vercel:dev
npm test
openspec validate --specs --strict
```

## 打包和密钥

- `receiver.config.json`、`.env`、`.env.local`、`dist/`、`.tmp-mchose-asar/`、`tmp/` 都应视为本地/生成/敏感上下文，不提交。
- 给目标电脑使用的私有包通过 `npm run receiver:bundle` 生成，默认输出到 `dist/k20gt-receiver-windows/`，再压缩为 `dist/k20gt-receiver-windows.zip`。
- bundle 可能包含真实 token，只能交付给可信单台机器，不公开上传。
- 默认不要打包 localhost/loopback API URL；只有本地测试时显式使用 `--allow-localhost`。
- 每次 receiver 运行脚本、配置字段、控制命令或依赖影响目标电脑运行后，应重新生成 bundle 和 zip，并同步更新 `docs/local-message-receiver.md`。

## 安全和体验约束

- 必须有发送 token 或密码，避免陌生人投递。
- 必须限制消息长度和发送频率，避免刷屏或协议异常。
- 她电脑端必须保留暂停/勿扰能力。
- 远程 board 是外部插入/抢占，不是 K20 GT 原生显示系统的新主人。
- board 到期、清空或 dismiss 后应释放远程占用并尽量恢复歌词开关/基底模式。
- 不做绕过付费服务、攻击他人设备、传播恶意控制工具的能力。

## 工作方式

- 新功能进入实现前，优先用 OpenSpec 写清楚目标、范围、设计和验收标准。
- 创建 OpenSpec change 前，先检查本文件的当前状态、`docs/project-history.md` 和相关规范，避免偏离最新共识。
- 完成 change 或关键探索确认后，更新相关规范/文档；本文件只记录核心状态和导航，不再写长流水。
- 不要随意改官方客户端安装目录。
- 对音响的写入应尽量可恢复、可暂停、可退出。
- 文档内容可以少，但必须真实、可追溯、方便下一次继续。

## 当前开放问题

- receiver 在真实长期设备/网络环境下的稳定性仍需观察。
- Vercel Deployment Protection 是长期关闭，还是引入自动化 bypass，尚未最终决定。
- 更理想的 restore 是保存/恢复当前 `screenState` 快照，而不是长期依赖一个 fallback preset payload。
- 图片上传协议能否稳定用于自定义图案或像素动画仍未验证。
- 后续正式体验仍需选择 Electron/Tauri 托盘、Windows 服务、或继续脚本级运行。
- 微信入口采用公众号/企业微信/网页跳转还是其他方式，仍作为后期探索。
