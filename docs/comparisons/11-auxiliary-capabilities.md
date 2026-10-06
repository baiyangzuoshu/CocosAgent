# 阶段 11：辅助能力的同一行为对照

先读[2.4 独立笔记](../2.x/11-auxiliary-capabilities.md)与[3.8 独立笔记](../3.x/11-auxiliary-capabilities.md)。本表比较游戏开发者会做的同一件事，以及在各自源码中能追到的边界；存储、业务 HTTP、WebSocket 及最小原生文件热更新已有两版 Mac 包轨迹，其他能力仍是手册与静态源码结论。

| 开发行为 | 2.4.15 | 3.8.7 |
| --- | --- | --- |
| 发一个业务 HTTP 请求 | [官网](https://docs.cocos.com/creator/2.4/manual/zh/scripting/network.html)以全局 `XMLHttpRequest` 为例；引擎资源下载也调用 XHR，但业务请求不经资源加载器。本仓库缺原生 XHR 绑定源码。 | [官网](https://docs.cocos.com/creator/3.8/manual/zh/advanced-topics/http.html)以 `fetch` 为例；Native 适配器 `fetch.js` 以 XHR 实现，再经本仓库 JSB XHR 与 C++ 网络层。 |
| 维持 WebSocket 连接 | 公开 `WebSocket`；原生还需勾选 Native Socket 模块。本仓库只可检查 JavaScript 调用边界。 | 公开 `WebSocket`；Native 适配器装入 `jsb.WebSocket`，本仓库能追到 JSB 对象与原生网络实现。 |
| 保存一项用户设置 | `cc.sys.localStorage → window.localStorage`，Web 分支做可用性探测；2.4 原生存储实现不在本仓库。 | `sys.localStorage` 同样做可用性探测；本仓库还含原生注册、SQLite/Android Java 分支。两版 API 相似不能证明文件位置或持久性相同。 |
| 切换游戏语言 | [2.4 官网](https://docs.cocos.com/creator/2.4/manual/zh/advanced-topics/i18n.html)描述外部 i18n 插件并提示其缺维护；示例未安装。 | [3.8 官网](https://docs.cocos.com/creator/3.8/manual/zh/editor/l10n/overview.html)以 L10N 编辑器工作流为主；旧 i18n 插件是另一条路。邻接引擎仓库未检出 L10N 实现，示例未启用。 |
| 更新已发布原生资源 | 原生 `jsb.AssetsManager` 使用 manifest、可写缓存与搜索路径；2.4 C++ 实现缺席。 | 原生 `native.AssetsManager` 对应 `AssetsManagerEx/Manifest` C++ 实现；搜索路径和脚本/Bundle 刷新时机需要分开检查。两者均不等于普通 `assetManager`。 |
| 调用平台 SDK | 官网 2.4 服务配置或目标原生工程、JSB 反射；仓库没有完整宿主绑定。 | 官网 3.8 原生工程持久目录与反射/JsbBridge；仓库含部分桥接实现，但具体 SDK 必须在项目里接入。 |

## 共同比较准则

网络先区分业务调用与 Asset Manager 下载，再记录 Web、原生或小游戏的宿主对象；相同 `XMLHttpRequest` 名字不保证底层相同。存储比较应使用独立临时键，分别观察写后、重启后和删除后，不据静态代码推断持久性。热更新比较要分 manifest 文件版本、搜索路径、JS 运行态与 Bundle 缓存，不能用一次资源加载成功代表新版本已生效。多语言与 SDK 首先定位插件/编辑器和项目原生工程；引擎仓库缺席的实现标为证据边界。

本阶段的最小验证和 skill 候选见[验证记录](../agent-foundation/skills/auxiliary-capabilities-validation.md)。

两份 Mac 存储轨迹的共同观察是：公开 `sys.localStorage` 与原生窗口的 `localStorage` 同一对象，唯一临时值可跨一次进程重启读取，删键后返回 `null`。这只比较相同开发行为的结果；2.4 原生存储绑定源码缺席，3.8 虽可追到 SQLite 绑定，两份历史包也未证明其内部实现完全相同。Web 预览、移动端与小游戏需分别验证。

两份 Mac [2.4 HTTP 轨迹](../agent-foundation/traces/2.4.15-stage11-mac-native-http.jsonl)与[3.8 HTTP 轨迹](../agent-foundation/traces/3.8.7-stage11-mac-native-http.jsonl)分别向本机服务请求 200 和 503。两版 XHR 都在两种状态下进入 `onload`；3.8 的 `fetch` 在两种状态下都 resolve，且包内标记 `fetch.polyfill=true`。这是 HTTP 响应状态的对照，不证明断网时的错误回调；3.8 的 `fetch → XHR` 具体实现关系由源码提供，探针只观察两种 API 的外部结果。

将端口改为“已绑定但未监听”后，当前 Mac 包的[2.4 XHR](../agent-foundation/traces/2.4.15-stage11-mac-native-connection-refused.jsonl)在 4 秒设置下进入 `ontimeout`；[3.8 XHR/fetch](../agent-foundation/traces/3.8.7-stage11-mac-native-connection-refused.jsonl)分别进入 `onerror` 与 rejected。两次独立运行结果相同，三者均未取得 HTTP 响应。这里的差异只代表这两个历史包及此连接条件；2.4 绑定实现缺席，3.8 包又未使用邻接源码，不可推广成两代 API 的通用差异。业务网络诊断应同时记录回调/Promise 结果与 `status`，并另测目标平台。

本机 WebSocket 文本回显在两版 Mac 包都完成[2.4 客户端](../agent-foundation/traces/2.4.15-stage11-mac-native-websocket.jsonl)与[3.8 客户端](../agent-foundation/traces/3.8.7-stage11-mac-native-websocket.jsonl)的 `open → message → close`；两份[2.4 服务器](../agent-foundation/traces/2.4.15-stage11-mac-native-websocket-server.jsonl)和[3.8 服务器](../agent-foundation/traces/3.8.7-stage11-mac-native-websocket-server.jsonl)轨迹确认握手、原文、关闭码 1000。两包均编入 Socket 模块。2.4 公开全局构造器可用，但 `jsb.WebSocket` 未暴露；3.8 两者都可读。2.4 关闭事件未观察到 `code/wasClean`，3.8 观察到 1000/true；这些只描述当前 Mac 包，不应从 2.4 缺字段推断所有平台都缺。

让服务器收到文本后重置 TCP、且不发送 WebSocket Close 帧时，两版[2.4 客户端](../agent-foundation/traces/2.4.15-stage11-mac-native-websocket-abrupt.jsonl)与[3.8 客户端](../agent-foundation/traces/3.8.7-stage11-mac-native-websocket-abrupt.jsonl)均在两轮实验中只观察到 `open → close`，没有 `onerror`；两份服务器轨迹分别见[2.4](../agent-foundation/traces/2.4.15-stage11-mac-native-websocket-abrupt-server.jsonl)与[3.8](../agent-foundation/traces/3.8.7-stage11-mac-native-websocket-abrupt-server.jsonl)。3.8 `close` 报 `code=1001/wasClean=false`，2.4 未提供这两个字段。正常关闭与这类异常断开都能进 `onclose`，所以只靠 `onerror` 会漏掉当前故障；应保存关闭码、清洁标志及服务器侧断开证据。此对照不覆盖握手失败、TLS、移动网络切换或其他平台。

显式设置 `binaryType='arraybuffer'` 并发送五字节后，两版 Mac 包的[2.4 客户端](../agent-foundation/traces/2.4.15-stage11-mac-native-websocket-binary.jsonl)与[3.8 客户端](../agent-foundation/traces/3.8.7-stage11-mac-native-websocket-binary.jsonl)均把原样字节作为 ArrayBuffer 交给 `onmessage`；服务器的[2.4 轨迹](../agent-foundation/traces/2.4.15-stage11-mac-native-websocket-binary-server.jsonl)与[3.8 轨迹](../agent-foundation/traces/3.8.7-stage11-mac-native-websocket-binary-server.jsonl)确认收到二进制帧。3.8 邻接 JSB 绑定有 ArrayBuffer/TypedArray 收发代码；2.4 对应源码缺席。此结果不证明两版默认 `binaryType` 一致，也不覆盖较大消息、分片及 Web 目标。

若服务器对 WebSocket Upgrade 请求返回 HTTP 403 而不发送 101，两版 Mac 包的[2.4 客户端](../agent-foundation/traces/2.4.15-stage11-mac-native-websocket-rejected-handshake.jsonl)和[3.8 客户端](../agent-foundation/traces/3.8.7-stage11-mac-native-websocket-rejected-handshake.jsonl)两轮都只出现 `error → close`，没有 `open`；[2.4 服务端](../agent-foundation/traces/2.4.15-stage11-mac-native-websocket-rejected-handshake-server.jsonl)与[3.8 服务端](../agent-foundation/traces/3.8.7-stage11-mac-native-websocket-rejected-handshake-server.jsonl)都记录 403。3.8 的 `close` 虽报 `code=0/wasClean=true`，握手实际上未成功；2.4 未给出关闭字段。与先前已建立连接后重置 TCP 的 `open → close` 对照，诊断规则应先问是否发生 `open`，再看 `error/close`，不能单凭 `wasClean` 推断连接建立。

原生热更新的只读[2.4 入口快照](../agent-foundation/traces/2.4.15-stage11-mac-native-hotupdate-inventory.jsonl)与[3.8 入口快照](../agent-foundation/traces/3.8.7-stage11-mac-native-hotupdate-inventory.jsonl)都表明同一包内同时存在普通资源 `assetManager` 与原生 `AssetsManager` 构造器。2.4 在 `boot` 开头记录搜索路径 `[""]`；3.8 在 `onPostInitBase` 记录 `data/`、`Resources/`、空路径。采样时点不同，不能把两组路径直接解释成版本设计差异；两套示例均无 `.manifest` 源文件，后续检查使用隔离的临时 manifest。

随后以[受控探针](../agent-foundation/probes/stage11-mac-hotupdate-check.py)分别在两包加载临时本地 manifest，并向本机服务查询相同版本。两版的[2.4 客户端](../agent-foundation/traces/2.4.15-stage11-mac-native-hotupdate-check.jsonl)与[3.8 客户端](../agent-foundation/traces/3.8.7-stage11-mac-native-hotupdate-check.jsonl)都记录构造时临时目录被前置到搜索路径、事件代码 `5 → 4`；两份[2.4 服务端](../agent-foundation/traces/2.4.15-stage11-mac-native-hotupdate-check-server.jsonl)与[3.8 服务端](../agent-foundation/traces/3.8.7-stage11-mac-native-hotupdate-check-server.jsonl)都只见一次版本 manifest 请求。没有调用 `update()`，也没有资源下载。2.4 末次 `getState()=12` 等于包内 `UP_TO_DATE=12`；3.8 末次 `getState()=13` 却等于包内 `FAIL_TO_UPDATE=13`。3.8.7 邻接 C++ 状态表含 `PREPARE_UPDATING`，JS 适配器表缺此项，导致从该项起的状态数值错位。3.8 在这个条件下应以 `ALREADY_UP_TO_DATE` 事件、manifest 版本和服务端请求判断结果；不要单凭 JS `State` 常量解释 `getState()`。这个差异属于当前包与邻接源码能共同支持的具体观察，尚未覆盖新版本下载与重启。

远端改为 `1.0.1` 且完整 manifest 含一个哨兵文件后，两包的[2.4 客户端](../agent-foundation/traces/2.4.15-stage11-mac-native-hotupdate-new-version-check.jsonl)与[3.8 客户端](../agent-foundation/traces/3.8.7-stage11-mac-native-hotupdate-new-version-check.jsonl)都先出现两个进度事件 5，再出现 `NEW_VERSION_FOUND=3`；两份[2.4 服务端](../agent-foundation/traces/2.4.15-stage11-mac-native-hotupdate-new-version-check-server.jsonl)与[3.8 服务端](../agent-foundation/traces/3.8.7-stage11-mac-native-hotupdate-new-version-check-server.jsonl)都只收到版本与完整 manifest 请求，没有哨兵文件请求。两版临时缓存均存下 `project.manifest.temp`。代码 3 回调时，2.4 `getState()=9` 对应包内 `READY_TO_UPDATE=9`；3.8 `getState()=10` 对应邻接 C++ 的 `READY_TO_UPDATE=10`，但包内 JS 将 10 标为 `UPDATING`。这只验证准备更新清单的检查路径，不能将 `NEW_VERSION_FOUND` 等同于资源已下载或新脚本已生效。

再在事件 3 中调用 `update()`，两版 Mac 包都完成单字节哨兵文件下载。[2.4 客户端与磁盘](../agent-foundation/traces/2.4.15-stage11-mac-native-hotupdate-update.jsonl)、[3.8 客户端与磁盘](../agent-foundation/traces/3.8.7-stage11-mac-native-hotupdate-update.jsonl)都给出事件 `5 → 5 → 3 → 5 → 5 → 6 → 8`；[2.4 服务端](../agent-foundation/traces/2.4.15-stage11-mac-native-hotupdate-update-server.jsonl)、[3.8 服务端](../agent-foundation/traces/3.8.7-stage11-mac-native-hotupdate-update-server.jsonl)都按序记录版本、完整 manifest 和单个资源请求。缓存最终含版本 `1.0.1` 的 manifest 与字节 `41`，临时下载目录已删除。独立重启后，两版构造管理器均从相同缓存读出 `1.0.1`、前置缓存目录，再检查只请求版本文件并返回代码 4。2.4 代码 8/4 时 `getState()=12` 与 JS `UP_TO_DATE` 一致；3.8 为 13，仍与 JS 状态表错位。探针是在启动流程中延后构造管理器，因此这里只验证**构造后的缓存选择与搜索路径**，不证明更新后的游戏脚本已在启动早期替换，也未触及 Bundle 刷新、失败重试或回滚。
