# 已选内容版本在 Web 预览中生效：首条纵向切片

本切片把[本地内容版本合同](content-release-0.1.md)与实际 Creator Web 预览相连。Host 在当前项目暂存红、蓝两个不可变版本，修改 `selected.json` 并通过运行时通道发送选中内容；Creator 运行时按各版路径加载纹理、`addRef()`、创建 SpriteFrame、切换可见 Sprite，等一次 `EVENT_AFTER_DRAW` 后才销毁旧 SpriteFrame、`decRef()` 旧纹理并调用非强制 `releaseUnusedAssets()`。成功回执包含版本指纹、资源 UUID 与当前引用数；Host 的 `content.runtime.accept` 再核对当前选中版本、指纹、资源身份与有效引用数，单独写 `effective.json`。`selected` 表示 Host 想应用的版本，`effective` 表示 Host 收到并核对的运行时成功回执。

实现分层：`tools/cocos-agent-bridge/runtime/content-swap-core.js` 管持有、替换和失败保留；两版示例分别在 `assets/Script/CocosAgentContentRuntime.js`、`assets/CocosAgentContentRuntime.js` 保存版本适配器；`probes/cocos-content-runtime-{2.4,3.8}.js` 和 `probes/cocos-content-runtime-live.mjs` 是较早的临时注入验收。2.4 通过 `cc.resources.load(图片名, cc.Texture2D)` 与 `_uuid` 识别纹理；3.8 用 `resources.load(图片名/texture, Texture2D)` 与 `uuid`。两版编辑器已导入适配器并生成 `.meta`。

2026-10-08 两版实际预览均完成：红版 `applied`、蓝版 `applied`；强制下一次红纹理加载失败时返回 `retained`，活动 Sprite 与 `effective` 仍为蓝版；Host 把 `selected` 回退到蓝版后再次选择红版，运行时成功应用并收到新的 `effective` 回执。画面证据：[2.4 红](traces/visual/cocos-content-runtime-2.4-red.png)、[2.4 蓝](traces/visual/cocos-content-runtime-2.4-blue.png)、[3.8 红](traces/visual/cocos-content-runtime-3.8-red.png)、[3.8 蓝](traces/visual/cocos-content-runtime-3.8-blue.png)。原始结构化回执：[2.4](traces/cocos-agent-content-runtime-2.4-web.json)、[3.8](traces/cocos-agent-content-runtime-3.8-web.json)。测试结束，探针节点销毁，两个示例中的临时 Host 版本文件和指针均已删除；主场景文件未变化。

## 2.4 正常启动通道验收

2026-10-08，2.4 示例通过 `HelloWorld.onLoad` 正常启动运行时适配器和 `CocosAgentRuntimeChannel`，不需要向预览注入源码。Host 只绑定 `127.0.0.1`，限定预览 Origin 和一次性随机令牌；游戏客户端只读取本地预览 URL 参数并通过 WebSocket 请求发布版本。实测红版 `applied`，红到蓝切换后蓝版 `applied`；主动关闭客户端 socket 后，客户端自动重连，Host 重发蓝版，运行时回复 `already-active`，截图仍为蓝色。

随后在同一个正常启动预览中，通过 Chrome DevTools Protocol 的网络拦截拒绝蓝色纹理 UUID 对应的导入请求。2.4 的资源加载曾重试请求；测试在故障窗口内拦截了四次匹配的导入 JSON 请求。运行时最终回传 `retained`（`download failed`），可见 Sprite 与 `effective` 保持红版，尽管 `selected` 暂时仍为蓝版。调用 `content.rollback` 后，Host 选择红版，运行时回 `already-active`，`effective` 仍记录红版；移除网络故障后重新选择蓝版，运行时回 `applied`，截图中心像素从失败期间的 `255,0,0` 变为 `0,0,255`。完整事件、请求 URL 与回执见 [2.4 通道验收 JSON](traces/cocos-agent-content-channel-2.4-web.json)；画面证据见[失败时保留红版](traces/visual/cocos-content-channel-2.4-failed-retained.png)、[重试后蓝版生效](traces/visual/cocos-content-channel-2.4-retried.png)和[断线重连后蓝版保持](traces/visual/cocos-content-channel-2.4-reconnected.png)。可重复脚本为 `probes/cocos-content-runtime-channel-live.mjs 2.4`。

这次实测证明本地 2.4 Web 预览中的一次纹理导入网络失败会走到运行时 `retained` 回执，并可经 Host 指针回滚与后续重试恢复。运行时核心单测仍覆盖加载失败和绘制确认失败；Host 通道测试仍覆盖失败回执不得覆盖 `effective`。它不证明其他失败类型、远端内容分发、原生版本生效或性能预算已验收。

正常启动通道的项目接线目前覆盖 2.4 Web 预览和 Mac 开发包；3.8 保留较早的临时注入轨迹，尚无项目启动接线验收。Host 本机通道的令牌只用于本机开发，不是模型凭证，也不能用于公开部署。一次绘制确认与截图只证明该 Web 运行中的画面可见，不给出帧预算或所有平台的 GPU 完成保证。Mac 原生接线和本次资源故障恢复边界见下文。

## 2.4 Mac 原生通道边界审计

2026-10-08 用 Creator 2.4.15 构建并编译当前 `Mac` 目标，两个构建步骤都完成；启动新包后可见 `Hello, World!` 场景。这只确认当前示例能生成并启动 Mac 原生包，不证明 CocosAgent 动态内容通道已连接。结构化边界记录见[原生 bootstrap 审计](traces/cocos-agent-content-runtime-native-bootstrap-2.4.jsonl)。

源码已说明为什么不能直接复用 Web 通道：`assets/Script/CocosAgentRuntimeChannel.js::session` 只从浏览器 `location` 读取 `cocosAgentPort` 和 `cocosAgentToken`；没有这两个预览 URL 参数时，`HelloWorld.onLoad` 不会挂载运行时。Host 的 `tools/cocos-agent-bridge/runtime/content-runtime-host.js::start` 要求显式提供准确的 `http://127.0.0.1:<port>/` 预览地址，并要求 WebSocket `Origin` 与该 origin 一致。Creator 预览通常使用 7456，独立构建包可使用自己的 loopback 静态服务端口。此次 Mac 启动没有启动 Host 连接，因此没有声称已经实测 native 连接失败或成功；结论是当时合同缺少 native session bootstrap。

## 2.4 Mac 原生会话接线

2026-10-08 已实现独立的 Mac 原生会话引导：Host 仍绑定 `127.0.0.1`，为每次会话生成随机 256-bit bearer token 和 session ID，将连接地址写入 `jsb.fileUtils.getWritablePath() + "cocos-agent/runtime-session.json"`。目录权限为 `0700`，会话文件为 `0600`；文件携带 15 分钟首次启动期限，Host 接受首个匹配会话后立即删除。运行时仅在 Creator 2.4 的 OS X 原生环境读取该文件，并发送平台、版本、场景及 session ID。Creator 的 JSB WebSocket 实测会携带 `Origin: http://127.0.0.1:<临时端口>`；原生 Host 只接受该 loopback Origin 形式并继续校验随机令牌。Web Host 也只接受精确匹配调用方配置的 `127.0.0.1` Origin，不接受其他 Host 或 HTTPS。

Host 的命令行接线见 [`tools/cocos-agent-bridge/README.md`](../../tools/cocos-agent-bridge/README.md)。2.4.15 Mac 包既有轨迹显示 `getWritablePath()` 为当前用户的 `Documents/`；调用时应传入实际包观测到的绝对路径，不在 Host 内推算操作系统目录。原生成功回执只由已认证的运行时通道写入；公开 `content.runtime.accept` 仍只接受 Web 预览回执，避免外部 Agent 冒充原生应用。

Host 级测试覆盖了 Mac JSB 的 loopback Origin、权限、首次认证、会话文件删除与 `effective` 回执。Creator 2.4.15 已重新 Build/Compile 并启动 Mac 包，真实通道完成红、蓝资源应用；对构建包缺少的资源返回 `retained`，屏幕仍显示蓝版；Host 回滚后运行时回 `already-active`，并再次确认蓝版 `effective`。真实握手还发现 JSB Origin 带临时端口，Host 据此采用严格的 `http://127.0.0.1:<port>` 规则。完整身份、指纹、UUID、回执和证据边界见[Mac 原生轨迹](traces/cocos-agent-content-channel-2.4-mac-native.jsonl)。此结果只覆盖本机 2.4 Mac 开发包；重启恢复、多轮内存/性能预算、其他构建身份与移动端尚未验证。

## Web-Mobile 构建包运行时通道

为使 Creator 的默认 7456 预览仍运行时能够单独打开 Web-Mobile 构建包，Host 接受调用方显式提供的准确 `http://127.0.0.1:<port>/` Origin。Host 继续只绑定 `127.0.0.1`、生成一次性会话 token，并拒绝其他 Host 与 HTTPS；集成测试确认非 `127.0.0.1` 主机和 HTTPS 会被拒绝。实际 2.4 Web-Mobile 构建包在独立 loopback 静态服务中启动后，`HelloWorld.onLoad` 经 URL 参数挂接认证通道，从包内 `resources` 加载蓝、红纹理。蓝 → 红回执均为 `applied`；`content.rollback` 选回蓝版后再次得到 `applied`，最终 `effective.json` 为原蓝色 release。浏览器画面按蓝、红、蓝验证；完整身份与回执见[构建包通道轨迹](traces/cocos-agent-content-build-2.4-runtime-web.jsonl)。临时红色 release 清理、原选中指针恢复；保留蓝色 `effective` 观测。该轨迹只证明此 Creator 2.4.15 Web-Mobile 包和当前本机资源，仍不代表远端内容分发、移动设备、原生构建或性能预算。
