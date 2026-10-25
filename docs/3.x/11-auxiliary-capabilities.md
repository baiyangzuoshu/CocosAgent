# 阶段 11：3.8.7 辅助能力

状态：已按 3.8 官网建立专题基线，完成 TypeScript/适配器/C++ 首轮定位；现有 Mac 包的存储、业务网络和最小文件热更新已有运行轨迹。该包使用 Creator 内置引擎，不能直接验证邻接源码改动；Web/小游戏、真实脚本覆盖、异常更新和 SDK 等仍待分别验证。

## 官网基线

| 主题 | 3.8 官方入口 | 开发者可见行为 |
| --- | --- | --- |
| HTTP/长连接 | [HTTP 请求](https://docs.cocos.com/creator/3.8/manual/zh/advanced-topics/http.html)、[WebSocket 客户端](https://docs.cocos.com/creator/3.8/manual/zh/advanced-topics/websocket.html) | 手册用 `fetch` 请求 HTTP，原生提供 Web 标准 WebSocket；平台证书条件须按 3.8 目标核实。 |
| 持久化 | [存储和读取用户数据](https://docs.cocos.com/creator/3.8/manual/zh/advanced-topics/data-storage.html) | `sys.localStorage` 保存字符串；手册称 Web 使用 Web Storage、原生使用 SQLite。 |
| 多语言 | [L10N 总览](https://docs.cocos.com/creator/3.8/manual/zh/editor/l10n/overview.html)、[旧 i18n 插件](https://docs.cocos.com/creator/3.8/manual/zh/advanced-topics/i18n.html) | 3.6 起有本地化编辑器、语言编译、组件及发布选项；旧 i18n 插件仍有页面，但官网建议 3.6+ 使用 L10N。 |
| 热更新 | [教程](https://docs.cocos.com/creator/3.8/manual/zh/advanced-topics/hot-update.html)、[AssetsManager 机制](https://docs.cocos.com/creator/3.8/manual/zh/advanced-topics/hot-update-manager.html) | 原生 `native.AssetsManager` 按 manifest 更新，搜索路径要在加载旧脚本前接入；脚本/Bundle 刷新常需重启或重新加载。 |
| 平台 SDK | [原生平台二次开发](https://docs.cocos.com/creator/3.8/manual/zh/advanced-topics/native-secondary-development.html)、[JS/Java Bridge](https://docs.cocos.com/creator/3.8/manual/zh/advanced-topics/js-java-bridge.html)、[JS/Objective-C Bridge](https://docs.cocos.com/creator/3.8/manual/zh/advanced-topics/js-oc-bridge.html) | 第三方 SDK 放在目标原生工程/项目持久化目录，通过反射或桥接接入脚本。 |

## 本仓库分层

### 游戏网络与资源下载

`platforms/native/builtin/index.js` 把绑定的 `jsb.XMLHttpRequest`、`jsb.WebSocket` 挂到原生类浏览器窗口；`platforms/native/builtin/jsb-adapter/window.js` 安装 `fetch`，其 `fetch.js::fetch` 再使用 `new XMLHttpRequest()`。所以在本快照的 Native 适配链中，官网 `fetch` 调用最终会落到 XHR 绑定。`native/cocos/bindings/manual/jsb_xmlhttprequest.cpp` 与 `jsb_websocket.cpp` 提供 JSB 对象，底层走 `native/cocos/network/`。Web 目标则使用浏览器对象；小游戏有各自 `platforms/minigame/.../wrapper`，具体宿主行为仍需目标环境验证。

`cocos/asset/asset-manager/download-file.ts` 是资源加载器的 XHR 路径；它与游戏脚本自行调用的 `fetch`/`WebSocket` 有共同的底层网络能力，却不是同一个请求调度入口。`downloader.ts` 的公开下载辅助接口在 3.7 起标为引擎内部接口。网络失败要先区分业务请求、Bundle/资源下载以及原生平台连接层。

[现有 Mac 包回环 HTTP 轨迹](../agent-foundation/traces/3.8.7-stage11-mac-native-http.jsonl)中，XHR 对 200/503 均执行 `onload`，`fetch` 对两者均 resolve 并给出相应 `status`/正文；`fetch.polyfill=true`。这验证该包中的公开请求结果，也与上面的 Native 适配源码相符，但探针没有逐条记录 C++ 内部调用。

[连接被拒绝轨迹](../agent-foundation/traces/3.8.7-stage11-mac-native-connection-refused.jsonl)另用仅绑定、不监听的 `127.0.0.1` 端口测试。两次独立运行均观察到 XHR `onerror`、`status=0`、`readyState=1`，以及 `fetch` 以 `TypeError: Network request failed` rejected；没有取得 HTTP 响应。邻接源码 `jsb_xmlhttprequest.cpp::onResponse` 对失败且响应码为 0/-1 的路径调用 `onerror`，`jsb-adapter/fetch.js::fetch` 将 XHR `onerror`/`ontimeout` 转为同一拒绝错误。包内结果与此一致，但不能证明当前包逐字使用邻接源码。TLS 和其他平台仍需独立实验。

当前 Mac 包的构建配置包含 `websocket` 模块并设置 `USE_SOCKET ON`。其[本机回显客户端轨迹](../agent-foundation/traces/3.8.7-stage11-mac-native-websocket.jsonl)中，全局 `WebSocket` 与 `jsb.WebSocket` 均为函数；客户端依次收到 `open`、原样文本 `message`、`close`。对应[服务器轨迹](../agent-foundation/traces/3.8.7-stage11-mac-native-websocket-server.jsonl)记录握手、同一文本及关闭码 1000；客户端 `close` 事件带 `code=1000`、`wasClean=true`。正常回显的多次运行中，回调当下读到的 `readyState` 曾为 2，也曾为 3，不把固定状态当成回调前置条件。邻接 `jsb_websocket.cpp::JsbWebSocketDelegate` 具有 open/message/close/error 派发路径，运行轨迹证明当前包的公开事件结果，但不证明包与邻接源码逐字相同。此实验仅测试本机 `ws://` 文本回显；`wss://`、二进制及 Web 仍待验证。

异常断开另用同一服务在收到文本后直接重置 TCP，不发送 WebSocket Close 帧。[客户端轨迹](../agent-foundation/traces/3.8.7-stage11-mac-native-websocket-abrupt.jsonl)和[服务器轨迹](../agent-foundation/traces/3.8.7-stage11-mac-native-websocket-abrupt-server.jsonl)两轮均记录 `open → close`，未触发 `error` 或 `message`；`close` 事件为 `code=1001`、`wasClean=false`、回调当下 `readyState=3`。邻接 `WebSocket-apple.mm::didFailWithError` 还存在 `onError → onClose` 路径，但该 TCP 重置条件没有走到可见的 `onerror`，不能把任一路径推广为所有故障。诊断时同时监听 `onerror` 与 `onclose`，并记录关闭字段。

二进制切口显式设置 `binaryType='arraybuffer'`，发送 `Uint8Array([0,1,127,128,255]).buffer`。[客户端轨迹](../agent-foundation/traces/3.8.7-stage11-mac-native-websocket-binary.jsonl)收到 `[object ArrayBuffer]` 且五字节原样返回；[服务器轨迹](../agent-foundation/traces/3.8.7-stage11-mac-native-websocket-binary-server.jsonl)确认收到二进制帧、回显后收关闭码 1000。邻接 `jsb_websocket.cpp::webSocketSend` 接受 ArrayBuffer/TypedArray，`JsbWebSocketDelegate::onMessage` 把原生二进制数据包装成 ArrayBuffer；运行轨迹与其一致，但当前包使用 Creator 内置引擎，不能证明逐字节走邻接源码。未测默认 `binaryType`、较大消息或分片。

握手失败切口由服务端收到 Upgrade 请求后直接返回 HTTP 403，不发送 101。[客户端轨迹](../agent-foundation/traces/3.8.7-stage11-mac-native-websocket-rejected-handshake.jsonl)两轮均为 `error → close`，没有 `open`；`close` 字段为 `code=0/wasClean=true`。[服务器轨迹](../agent-foundation/traces/3.8.7-stage11-mac-native-websocket-rejected-handshake-server.jsonl)确认 403。邻接 `WebSocket-apple.mm::didFailWithError` 有 `onError → onClose(code=0, wasClean=true)` 路径，与包内可见顺序和字段相符，但不能证明此包使用邻接源码。这里的 `wasClean=true` 不表示握手成功，应同时检查是否发生 `open`，并保留服务端 HTTP 响应证据。

### 本地存储

`cocos/core/platform/sys.ts::init` 等待 `systemInfo.init()` 后从 `window.localStorage` 初始化 `sys.localStorage`，试写、试删失败则设置警告降级对象。原生 `native/cocos/bindings/manual/jsb_cocos_manual.cpp::register_sys_localStorage` 注册 `getItem/setItem/removeItem/clear/key/length`，并把数据库路径设在可写目录的 `jsb.sqlite`；Mac 等非 Android 路径进入 `native/cocos/storage/local-storage/LocalStorage.cpp` 的 SQLite 实现，Android 则经 `LocalStorage-android.cpp` 转 Java。`platforms/native/builtin/jsb-adapter/window.js` 又将原生窗口的 `localStorage` 指向 `sys.localStorage`。这些文件说明绑定与初始化的设计；下面的 Mac 包轨迹补充了当前包的实际对象接线与跨重启结果。

[现有 Mac 包轨迹](../agent-foundation/traces/3.8.7-stage11-mac-native-storage.jsonl)用唯一临时键记录首次写入、另一次进程重启后读取及删除：`null → 临时值 → 重启后仍为临时值 → null`；`sys.localStorage === window.localStorage`、`isNative=true/isBrowser=false`。这一观察验证当前包的接线和持久结果，但未打开 SQLite 文件，不证明数据库文件的实际路径；该包采用 Creator 内置引擎。临时键和生成脚本均已清理。

### 多语言

官网 L10N 是编辑器面板、译文数据、编译、`L10nLabel` 和发布设置组成的工作流。邻接 `engine/3.8.7engine/cocos/`、`editor/`、`exports/`、`native/` 未检出 `L10nLabel` 或 `localization-editor` 实现；本地示例也未启用 L10N。不能把引擎组件元数据中的 `i18n:` 编辑器键当作游戏运行时翻译器。后续若研究 L10N 内部实现，须检查 Creator 编辑器安装包或装有该扩展的实际项目，再以最小双语言场景验证编译与运行。

### 原生热更新

`cocos/native-binding/index.ts` 声明 `native.AssetsManager` 与事件，`impl.ts` 将 `globalJsb.AssetsManager` 转出；`platforms/native/engine/jsb-assets-manager.js` 定义状态/事件常量。实际 manifest 读取、缓存/临时目录、版本比较、下载及状态推进在 `native/extensions/assets-manager/AssetsManagerEx.cpp` 与 `Manifest.cpp`；`AssetsManagerEx::prepareLocalManifest` 会前置本地 manifest 搜索路径。此文件级热更新不同于 `cocos/asset/asset-manager/` 的运行时资源引用与 Bundle 缓存。官网指出 Web 不使用原生热更新，且更新后旧 JS 对象及旧 Bundle 配置不会自动变新。

这一接线还有诊断上的副作用：`AssetsManagerEx::loadLocalManifest` 可比较包内与缓存 manifest、删除旧缓存目录，并调用 `prepareLocalManifest → Manifest::prependSearchPaths` 改变 `FileUtils` 搜索路径。因此仅想检查现场时，不要为“试一下 API”创建一个管理器。`checkUpdate` 与 `update` 又会按内部状态选择远端版本下载或更新；`prepareUpdateAsync` 清空本轮下载状态，成功时 `updateSucceed` 合并临时文件、换本地 manifest、前置搜索路径，再派发 `UPDATE_FINISHED`。下方隔离包轨迹验证这一链的可见结果，不能证明历史包逐字采用邻接源码。

[当前 Mac 包的只读入口快照](../agent-foundation/traces/3.8.7-stage11-mac-native-hotupdate-inventory.jsonl)在 `onPostInitBase` 观察到 `cc.assetManager` 是对象，`cc.native.AssetsManager` 和旧 `jsb.AssetsManager` 均为函数，搜索路径为 `data/`、`Resources/`、空路径。示例目录未检出 `.manifest` 文件。它只证明该包的入口与当前搜索路径；2.4 轨迹采样在更早的 `boot`，不可把两份路径数组当成同一时点的版本差异。

[受控同版本检查](../agent-foundation/traces/3.8.7-stage11-mac-native-hotupdate-check.jsonl)在当前 Mac 包内构造 `cc.native.AssetsManager`，本地与回环服务器的版本均为 `1.0.0`，仅调用 `checkUpdate()`。本地 manifest 成功加载；构造时搜索路径前置临时 manifest 所在目录。回调依次给出代码 5（`UPDATE_PROGRESSION`）和 4（`ALREADY_UP_TO_DATE`）。[服务端轨迹](../agent-foundation/traces/3.8.7-stage11-mac-native-hotupdate-check-server.jsonl)仅有一次 `version.manifest` 请求，未请求项目 manifest 或资源文件。邻接 `AssetsManagerEx::parseVersion` 在版本不低于远端时将状态设为 `UP_TO_DATE`，删除临时下载目录，再派发事件；包内观察与此路径一致，但不能证明包与邻接源码逐字相同。

这里发现了包内**状态常量错位**：回调代码 4 时 `getState()=13`，而同包 `cc.native.AssetsManager.State.UP_TO_DATE=12`、`FAIL_TO_UPDATE=13`。邻接 C++ `AssetsManagerEx.h::State` 在 `NEED_UPDATE` 后还有 `PREPARE_UPDATING`，其 `UP_TO_DATE` 枚举值为 13；邻接 `platforms/native/engine/jsb-assets-manager.js` 与已打包 `jsb-adapter/engine-adapter.js` 的 JS 常量表缺少该项。诊断这个包的结果应以事件代码 4 和 manifest/请求证据为准，不能把 `getState()===State.FAIL_TO_UPDATE` 当成真实更新失败；其他状态值也须逐项核对 C++ 与包内常量。探针仅用唯一临时目录，结束后已清理；这一同版本实验本身不验证下载和重启，下面另列单文件实验。

另把远端版本设为 `1.0.1`，完整 manifest 中加入一个哨兵文件，但服务端不提供其内容。[客户端轨迹](../agent-foundation/traces/3.8.7-stage11-mac-native-hotupdate-new-version-check.jsonl)依次收到代码 `5 → 5 → 3`（`NEW_VERSION_FOUND`）；代码 3 回调的 `getState()=10`。邻接 C++ `State::READY_TO_UPDATE=10`，而当前包 JS 表将 10 标为 `UPDATING`，进一步证实状态常量错位。[服务端轨迹](../agent-foundation/traces/3.8.7-stage11-mac-native-hotupdate-new-version-check-server.jsonl)按序只见版本与完整 manifest 请求，未见哨兵文件请求；临时缓存留下 `project.manifest.temp`。邻接 `AssetsManagerEx::parseManifest → prepareUpdateAsync` 对 `CHECK_UPDATE` 先异步准备差异清单再派发 `NEW_VERSION_FOUND`，与包内结果一致；当前包是否逐字采用该源码仍未证明。这里没有调用 `update()`，不能写成已更新资源。

再在代码 3 回调中调用 `update()`，服务器提供单字节 `A`。[客户端与磁盘轨迹](../agent-foundation/traces/3.8.7-stage11-mac-native-hotupdate-update.jsonl)给出 `5 → 5 → 3 → 5 → 5 → 6 → 8`；代码 8（`UPDATE_FINISHED`）时本地版本为 `1.0.1`，缓存目录已前置到搜索路径。[服务端](../agent-foundation/traces/3.8.7-stage11-mac-native-hotupdate-update-server.jsonl)依次收到版本、完整 manifest、带 md5 参数的哨兵文件请求。进程结束后的缓存含 `project.manifest`（`1.0.1`）和 `sentinel.bin`（十六进制 `41`），无临时下载目录。重新启动包并在相同隔离缓存上构造管理器后，本地版本为 `1.0.1`，搜索路径首项为缓存目录，`checkUpdate()` 只请求版本文件并返回代码 4。邻接 `AssetsManagerEx::updateSucceed` 先合并缓存、换本地 manifest、前置搜索路径再派发代码 8，与上述可见顺序一致。3.8 在代码 8 和重启后代码 4 时仍读到 `getState()=13`，要按 C++ `UP_TO_DATE` 理解，而不能按包内 JS `FAIL_TO_UPDATE=13` 误判。

这个重启实验在 `onPostInitBase` 后 500ms 才注入管理器；它验证缓存 manifest 的重新选择和构造时的搜索路径，不证明更新后的 JS 在游戏启动前被加载，也不验证 Bundle 运行态刷新。真实脚本覆盖、断线恢复、校验失败和其他平台还需独立验证。

### 平台 SDK

`cocos/native-binding/index.ts` 暴露反射/JsbBridge 类型，`impl.ts` 还提供 JS 事件包装；对应 Java/Objective-C/ArkTS 的手动绑定在 `native/cocos/bindings/manual/JavaScriptJavaBridge.cpp`、`JavaScriptObjCBridge.mm`、`JavaScriptArkTsBridge.cpp`。这些是脚本到平台语言的桥，不代表任何第三方 SDK 已集成。官网把持久化原生改动放在项目的 `native/engine/...`，构建目录是生成工程；应从具体 SDK 的项目配置、原生类和调用点追踪。

## 下一轮最小验证

1. 现有 Mac 包的唯一临时键写入、重启读取与删除已记录；下一步在 Web 预览独立复测，避免 `clear()`。数据库文件实际路径仍需另查。
2. Mac 包的 `fetch` 与 XHR 已分别验证回环 HTTP 200/503 和连接被拒绝，WebSocket 已验证本机文本/二进制回显、TCP 重置和 HTTP 403 握手拒绝；下一步在 Web 预览复测，另测 `wss://`、较大/分片消息。HTTPS/TLS、小游戏网络权限和外部服务另列平台试验。
3. 热更新的同版本/新版本检查、单文件下载及重启后缓存选择已在隔离目录验证；下一步用真实游戏脚本或资源检查启动前搜索路径、失败重试与回滚。先核对 3.8 的 JS/C++ 状态常量错位。L10N 与 SDK 需要编辑器扩展或具体 SDK，当前两个示例不足以测其内部链。

验证矩阵及候选 skill 状态见[阶段 11 记录](../agent-foundation/skills/auxiliary-capabilities-validation.md)。
