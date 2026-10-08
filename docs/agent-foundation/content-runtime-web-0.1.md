# 已选内容版本在 Web 预览中生效：首条纵向切片

本切片把[本地内容版本合同](content-release-0.1.md)与实际 Creator Web 预览相连。Host 在当前项目暂存红、蓝两个不可变版本，修改 `selected.json` 并通过运行时通道发送选中内容；Creator 运行时按各版路径加载纹理、`addRef()`、创建 SpriteFrame、切换可见 Sprite，等一次 `EVENT_AFTER_DRAW` 后才销毁旧 SpriteFrame、`decRef()` 旧纹理并调用非强制 `releaseUnusedAssets()`。成功回执包含版本指纹、资源 UUID 与当前引用数；Host 的 `content.runtime.accept` 再核对当前选中版本、指纹、资源身份与有效引用数，单独写 `effective.json`。`selected` 表示 Host 想应用的版本，`effective` 表示 Host 收到并核对的运行时成功回执。

实现分层：`tools/cocos-agent-bridge/runtime/content-swap-core.js` 管持有、替换和失败保留；两版示例分别在 `assets/Script/CocosAgentContentRuntime.js`、`assets/CocosAgentContentRuntime.js` 保存版本适配器；`probes/cocos-content-runtime-{2.4,3.8}.js` 和 `probes/cocos-content-runtime-live.mjs` 是较早的临时注入验收。2.4 通过 `cc.resources.load(图片名, cc.Texture2D)` 与 `_uuid` 识别纹理；3.8 用 `resources.load(图片名/texture, Texture2D)` 与 `uuid`。两版编辑器已导入适配器并生成 `.meta`。

2026-10-08 两版实际预览均完成：红版 `applied`、蓝版 `applied`；强制下一次红纹理加载失败时返回 `retained`，活动 Sprite 与 `effective` 仍为蓝版；Host 把 `selected` 回退到蓝版后再次选择红版，运行时成功应用并收到新的 `effective` 回执。画面证据：[2.4 红](traces/visual/cocos-content-runtime-2.4-red.png)、[2.4 蓝](traces/visual/cocos-content-runtime-2.4-blue.png)、[3.8 红](traces/visual/cocos-content-runtime-3.8-red.png)、[3.8 蓝](traces/visual/cocos-content-runtime-3.8-blue.png)。原始结构化回执：[2.4](traces/cocos-agent-content-runtime-2.4-web.json)、[3.8](traces/cocos-agent-content-runtime-3.8-web.json)。测试结束，探针节点销毁，两个示例中的临时 Host 版本文件和指针均已删除；主场景文件未变化。

## 2.4 正常启动通道验收

2026-10-08，2.4 示例通过 `HelloWorld.onLoad` 正常启动运行时适配器和 `CocosAgentRuntimeChannel`，不需要向预览注入源码。Host 只绑定 `127.0.0.1`，限定预览 Origin 和一次性随机令牌；游戏客户端只读取本地预览 URL 参数并通过 WebSocket 请求发布版本。实测红版 `applied`，红到蓝切换后蓝版 `applied`；主动关闭客户端 socket 后，客户端自动重连，Host 重发蓝版，运行时回复 `already-active`，截图仍为蓝色。

随后在同一个正常启动预览中，通过 Chrome DevTools Protocol 的网络拦截拒绝蓝色纹理 UUID 对应的导入请求。2.4 的资源加载曾重试请求；测试在故障窗口内拦截了四次匹配的导入 JSON 请求。运行时最终回传 `retained`（`download failed`），可见 Sprite 与 `effective` 保持红版，尽管 `selected` 暂时仍为蓝版。调用 `content.rollback` 后，Host 选择红版，运行时回 `already-active`，`effective` 仍记录红版；移除网络故障后重新选择蓝版，运行时回 `applied`，截图中心像素从失败期间的 `255,0,0` 变为 `0,0,255`。完整事件、请求 URL 与回执见 [2.4 通道验收 JSON](traces/cocos-agent-content-channel-2.4-web.json)；画面证据见[失败时保留红版](traces/visual/cocos-content-channel-2.4-failed-retained.png)、[重试后蓝版生效](traces/visual/cocos-content-channel-2.4-retried.png)和[断线重连后蓝版保持](traces/visual/cocos-content-channel-2.4-reconnected.png)。可重复脚本为 `probes/cocos-content-runtime-channel-live.mjs 2.4`。

这次实测证明本地 2.4 Web 预览中的一次纹理导入网络失败会走到运行时 `retained` 回执，并可经 Host 指针回滚与后续重试恢复。运行时核心单测仍覆盖加载失败和绘制确认失败；Host 通道测试仍覆盖失败回执不得覆盖 `effective`。它不证明其他失败类型、远端内容分发、原生版本生效或性能预算已验收。

正常启动通道仅完成 2.4 Web 预览验证；3.8 保留较早的临时注入轨迹，尚无项目启动接线验收。该 Host 本机通道没有外部用户认证能力，令牌只用于本机开发预览；URL 中的令牌不可复用于模型凭证或公开部署。一次绘制确认与截图只证明本次 Web 画面可见，不给出帧预算或所有平台的 GPU 完成保证。Mac 原生包此前只验证纹理加载/释放，动态版本生效与运行时通道仍未在原生包验收。

## 2.4 Mac 原生通道边界审计

2026-10-08 用 Creator 2.4.15 构建并编译当前 `Mac` 目标，两个构建步骤都完成；启动新包后可见 `Hello, World!` 场景。这只确认当前示例能生成并启动 Mac 原生包，不证明 CocosAgent 动态内容通道已连接。结构化边界记录见[原生 bootstrap 审计](traces/cocos-agent-content-runtime-native-bootstrap-2.4.jsonl)。

源码已说明为什么不能直接复用 Web 通道：`assets/Script/CocosAgentRuntimeChannel.js::session` 只从浏览器 `location` 读取 `cocosAgentPort` 和 `cocosAgentToken`；没有这两个预览 URL 参数时，`HelloWorld.onLoad` 不会挂载运行时。Host 的 `tools/cocos-agent-bridge/runtime/content-runtime-host.js::start` 也只接受 2.4 Web 预览 `http://127.0.0.1:7456/`，并要求 WebSocket `Origin` 与预览源一致。此次 Mac 启动没有启动 Host 连接，因此没有声称已经实测 native 连接失败或成功；结论是当前合同缺少 native session bootstrap。

下一步先为 2.4 Mac 开发包确定独立的本地 session 交付和认证边界，保持 Web 预览的 Origin 检查不变；再实现并验收原生应用收到版本、应用资源、提交 `effective` 回执，以及资源加载失败时保留旧内容和 Host 回滚。移动端不由本次 Mac 证据覆盖。
