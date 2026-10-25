# 阶段 11：2.4.15 辅助能力

状态：已按 2.4 官网建立专题基线，并完成本仓库 JavaScript 源码首轮定位；现有 Mac 包的存储、业务网络和最小文件热更新已有运行轨迹。Web/小游戏、真实游戏脚本覆盖、异常更新及 SDK 等仍待分别验证。这里的 `assetManager`（资源加载）与原生 `jsb.AssetsManager`（文件热更新）是两个问题。

## 官网基线

| 主题 | 2.4 官方入口 | 开发者可见行为 |
| --- | --- | --- |
| 网络 | [标准网络接口](https://docs.cocos.com/creator/2.4/manual/zh/scripting/network.html) | 游戏脚本使用 `XMLHttpRequest` 或 `WebSocket`。Web 使用浏览器接口；原生需宿主实现，且原生 WebSocket 要在模块设置启用 Native Socket。 |
| 持久化 | [存储和读取用户数据](https://docs.cocos.com/creator/2.4/manual/zh/advanced-topics/data-storage.html) | `cc.sys.localStorage` 是 Web Storage 风格接口；手册称 Web 直用浏览器存储、原生使用 SQLite。 |
| 游戏多语言 | [i18n 游戏多语言支持](https://docs.cocos.com/creator/2.4/manual/zh/advanced-topics/i18n.html) | 外部编辑器扩展插件提供 Label/Sprite 多语言；官网明确提示久未维护、可能无法运行，建议自行动态加载。 |
| 热更新 | [教程](https://docs.cocos.com/creator/2.4/manual/zh/advanced-topics/hot-update.html)、[AssetsManager 机制](https://docs.cocos.com/creator/2.4/manual/zh/advanced-topics/assets-manager.html) | 原生 `jsb.AssetsManager` 比对 manifest 并下载文件，通过可写目录与搜索路径覆盖包内文件；Web 不走该机制。 |
| 平台 SDK | [SDK 集成](https://docs.cocos.com/creator/2.4/manual/zh/sdk/index.html)、[Java 反射](https://docs.cocos.com/creator/2.4/manual/zh/advanced-topics/java-reflection.html)、[Objective-C 反射](https://docs.cocos.com/creator/2.4/manual/zh/advanced-topics/oc-reflection.html) | SDK 接入依赖编辑器服务配置或原生工程/JSB 桥，需按目标平台取证。 |

## 本仓库分层

### 网络与资源下载

`engine/2.4.15engine/cocos2d/core/asset-manager/download-file.js` 的资源下载会创建 `XMLHttpRequest`；`downloader.js::downloadFile` 是资源管线入口。游戏脚本手册直接使用全局 `XMLHttpRequest`/`WebSocket`，而不是要求经过 `cc.assetManager`。`cocos2d/core/asset-manager/deprecated.js::getXMLHttpRequest` 也仅返回新建的全局 XHR，并已标为弃用。由此不能从资源下载器的重试/缓存规则推导游戏自写请求的行为。

此引擎目录不含对应 2.4 原生 XHR/WebSocket 的 C++ 实现，也不含小游戏宿主的最终网络对象。原生网络可用性、TLS/证书、超时与回调线程需要在具体构建包中验证。

[现有 Mac 包回环 HTTP 轨迹](../agent-foundation/traces/2.4.15-stage11-mac-native-http.jsonl)中，游戏脚本的 XHR 对 200 与 503 都执行 `onload`，`readyState=4`，并保留相应状态码和响应体。服务器返回 503 不等于传输失败；游戏业务代码必须自行检查 `status`。

[连接被拒绝轨迹](../agent-foundation/traces/2.4.15-stage11-mac-native-connection-refused.jsonl)另用仅绑定、不监听的 `127.0.0.1` 端口测试。在 `xhr.timeout=4000` 条件下，两次独立运行均只观察到 `ontimeout`，当时 `status=0`、`readyState=1`、正文为空；没有观察到 `onerror`。本仓库缺 2.4 原生绑定源码，不能据此归纳所有连接错误或解释其底层原因。两项实验都没有调用资源下载器，也未测试 WebSocket 或其他平台。

WebSocket 另按官网的 Native Socket 前置条件检查当前 Mac 包：其原生工程编译参数有 `USE_SOCKET=1`，模块注册代码在该宏下注册 WebSocket。以[本机回显客户端轨迹](../agent-foundation/traces/2.4.15-stage11-mac-native-websocket.jsonl)和[服务器轨迹](../agent-foundation/traces/2.4.15-stage11-mac-native-websocket-server.jsonl)验证：全局 `WebSocket` 为函数，`jsb.WebSocket` 为 `undefined`；客户端依次收到 `open`、原样文本 `message`、`close`，服务器见握手、同一文本和关闭码 1000。2.4 包的 `close` 事件未给出 `code/wasClean` 字段，不能把这些字段当作本包已验证的公开行为。两次运行中关闭回调读取的 `readyState` 不同，不据此总结固定时序。此实验只测本机 `ws://` 文本回显，没有覆盖 `wss://`、二进制、异常断开或 Web。

异常断开另用相同本机服务，在收到客户端一条文本后直接重置 TCP，不发送 WebSocket Close 帧。[客户端轨迹](../agent-foundation/traces/2.4.15-stage11-mac-native-websocket-abrupt.jsonl)与[服务器轨迹](../agent-foundation/traces/2.4.15-stage11-mac-native-websocket-abrupt-server.jsonl)记录两轮相同顺序：`open → close`，没有 `message` 或 `error`；`close` 当下 `readyState=3`，但事件仍未给出 `code/wasClean`。因此在这个包上不能只监听 `onerror` 来判断连接中断。此结果不证明握手失败、超时、移动网络切换或其他平台的回调规律。

二进制切口将 `binaryType` 显式设为 `arraybuffer`，发送 `Uint8Array([0,1,127,128,255]).buffer`。[客户端轨迹](../agent-foundation/traces/2.4.15-stage11-mac-native-websocket-binary.jsonl)的 `message.data` 是 `[object ArrayBuffer]`，五个字节原样返回；[服务器轨迹](../agent-foundation/traces/2.4.15-stage11-mac-native-websocket-binary-server.jsonl)记录相同二进制帧和正常关闭。该包确实能完成这条二进制路径，但 2.4 原生绑定不在本仓库，无法从邻接源码解释具体拷贝和所有权规则。未测默认 `binaryType`、较大消息或分片。

握手失败切口由服务端收到 Upgrade 请求后直接返回 HTTP 403，不发送 101。[客户端轨迹](../agent-foundation/traces/2.4.15-stage11-mac-native-websocket-rejected-handshake.jsonl)两轮均为 `error → close`，没有 `open`；[服务端轨迹](../agent-foundation/traces/2.4.15-stage11-mac-native-websocket-rejected-handshake-server.jsonl)确认 403。该包的 `close` 事件依旧没有 `code/wasClean`，JS 回调也未包含 HTTP 403 状态，因此要查服务器侧握手响应才能定位拒绝原因。它与已建立连接后的 TCP 重置是两个不同故障切口。

### 本地存储

`cocos2d/core/platform/CCSys.js` 在 JSB 分支把 `cc.sys.localStorage` 指向 `window.localStorage`；Web 分支读取 `window.localStorage` 并试写、试删探测可用性，异常时换成只警告的降级对象。因此 `cc.sys.localStorage` 是公开访问面，存储持久性由当前宿主对象决定。官网对原生 SQLite 的说明属于宿主实现承诺，本仓库没有 2.4 SQLite 绑定源码，不能据此说明具体文件位置或事务规则。

[现有 Mac 包轨迹](../agent-foundation/traces/2.4.15-stage11-mac-native-storage.jsonl)用唯一临时键记录首次写入、另一次进程重启后读取及删除：`null → 临时值 → 重启后仍为临时值 → null`。包内 `cc.sys.localStorage === window.localStorage`，且 `isNative=true/isBrowser=false`。这验证该包的持久行为，不揭示 2.4 SQLite 内部或其他平台的持久性；临时键和生成脚本均已清理。

### 游戏多语言

本仓库的 `i18n:` 字符串主要是组件在编辑器中的菜单/提示键，不等于游戏官网插件的翻译表或 `LocalizedLabel` 实现。两个本地示例未安装官网 i18n 插件；当前无法从本引擎源码还原它的场景组件、数据切换或构建流程。若未来选择动态加载方案，应单独按资源系统研究，而不把官网插件的行为归入引擎内核。

### 热更新与 SDK

普通 `cc.assetManager` 位于 `cocos2d/core/asset-manager/`，处理 Creator 资源加载、Bundle、缓存与释放；手册的 `jsb.AssetsManager` 则作用于原生发布包的文件版本、下载和搜索路径。本仓库没有后者的 2.4 C++ 实现，也没有示例项目热更新组件或 manifest。不能用前者的 `releaseAsset` 判断热更新文件是否删除或生效。

[当前 Mac 包的只读入口快照](../agent-foundation/traces/2.4.15-stage11-mac-native-hotupdate-inventory.jsonl)在 `boot` 开头观察到 `cc.assetManager` 是对象、`jsb.AssetsManager` 是函数、`jsb.fileUtils.getSearchPaths()` 为 `[""]`。这证明该包暴露原生热更新入口，并不证明已配置 manifest 或完成更新；示例目录未检出 `.manifest` 文件。探针没有构造管理器、改变搜索路径或发起下载。

[受控同版本检查](../agent-foundation/traces/2.4.15-stage11-mac-native-hotupdate-check.jsonl)在当前 Mac 包内构造 `jsb.AssetsManager`，本地与回环服务器的版本均设为 `1.0.0`，只调用 `checkUpdate()`。本地 manifest 成功加载；构造时搜索路径由 `[""]` 变为“临时 manifest 所在目录、空路径”。回调先报告代码 5（`UPDATE_PROGRESSION`）、再报告代码 4（`ALREADY_UP_TO_DATE`），末次 `getState()=12`，与包内 `State.UP_TO_DATE=12` 一致。[服务端轨迹](../agent-foundation/traces/2.4.15-stage11-mac-native-hotupdate-check-server.jsonl)只有一次 `version.manifest` 请求，没有项目 manifest 或资源请求。此版本的原生 C++ 实现不在本仓库，因此不能据此解释其内部清理顺序；探针仅用唯一临时目录，结束后已清理。这一同版本实验本身不验证下载和重启；下面另列单文件实验。

将远端版本改为 `1.0.1` 并在完整 manifest 中放一个未提供下载端点的哨兵文件后，[客户端轨迹](../agent-foundation/traces/2.4.15-stage11-mac-native-hotupdate-new-version-check.jsonl)为事件 `5 → 5 → 3`（`NEW_VERSION_FOUND`），最后 `getState()=9`，与当前包 JS 常量 `READY_TO_UPDATE=9` 一致。[服务端轨迹](../agent-foundation/traces/2.4.15-stage11-mac-native-hotupdate-new-version-check-server.jsonl)按序只有 `version.manifest → project.manifest`，没有哨兵文件请求；临时缓存中留下 `project.manifest.temp`。这表明当前包的 `checkUpdate()` 在此条件下准备了更新清单，并未下载资源。由于 2.4 C++ 实现缺席，不能仅凭这些外部事件进一步断言内部线程和文件提交细节。

最后在代码 3 回调中调用 `update()`，本机服务提供单字节 `A`。独立的[客户端与磁盘轨迹](../agent-foundation/traces/2.4.15-stage11-mac-native-hotupdate-update.jsonl)记录 `5 → 5 → 3 → 5 → 5 → 6 → 8`；代码 8（`UPDATE_FINISHED`）时本地 manifest 版本为 `1.0.1`，缓存目录已前置到搜索路径。[服务端轨迹](../agent-foundation/traces/2.4.15-stage11-mac-native-hotupdate-update-server.jsonl)确认依次请求版本、完整 manifest、带 md5 查询参数的 `sentinel.bin`。结束后的缓存有 `project.manifest`（`1.0.1`）和 `sentinel.bin`（十六进制 `41`），临时下载目录已消失。另起一个进程并在相同隔离缓存上重新构造管理器时，本地版本为 `1.0.1`，搜索路径首先是缓存目录，`checkUpdate()` 只请求版本文件并返回代码 4。这里验证的是**探针构造管理器之后**的缓存选择与搜索路径；没有把新脚本放进包内启动链，也没有验证游戏脚本在启动早期被覆盖。2.4 原生 C++ 实现仍缺席，错误/断线/回滚尚需另测。

官网 SDK 页主要说明编辑器服务项；若诊断项目第三方 SDK，先检查目标原生工程、插件、JSB 反射调用及平台构建配置。本地两个 2.4 目录未提供通用 SDK 注册中心的源码证据。

## 下一轮最小验证

1. 现有 Mac 包的唯一临时键写入、重启读取与删除已记录；下一步在 2.4 Web 预览独立复测，记录 `isNative`、存储对象类型。不得调用 `clear()`，避免改动用户数据。
2. Mac 包的业务 XHR 已分别验证 200/503 与连接被拒绝，WebSocket 已验证本机文本/二进制回显、TCP 重置和 HTTP 403 握手拒绝；下一步在 Web 预览复测，并单独验证资源管线下载、其他传输错误、`wss://` 与较大/分片二进制消息。Native WebSocket 仍须先确认目标包模块设置。
3. 热更新的同版本检查、新版本检查、单文件下载及重启后缓存选择已在隔离目录验证；下一步用真实游戏脚本或资源验证启动前搜索路径接线、失败重试与回滚。SDK 调用另选具体平台案例。

验证矩阵及候选 skill 状态见[阶段 11 记录](../agent-foundation/skills/auxiliary-capabilities-validation.md)。
