# Creator 2.4 动态内容压力与性能预算：Web-Mobile 筛查

本切片为 Creator 2.4.15 的动态资源替换建立可复跑筛查。探针针对已验证的 Web-Mobile 构建创建临时 Sprite 节点，不改磁盘场景、不改 release 指针；每轮替换 PNG、创建并安装 SpriteFrame、更新节点位置和缩放、等待 `EVENT_AFTER_DRAW`，再释放旧资源。结束时销毁临时节点、释放显式引用，并读回资源有效性与 Asset Cache。新版合同要求分别验证冷缓存加载、热缓存加载、解析耗时、帧间隔、RGBA 工作集估算和生命周期不变量。

脚本：[`cocos-content-stress-2.4-live.mjs`](probes/cocos-content-stress-2.4-live.mjs) 驱动不可变构建、无头 Chrome 与本机 loopback 服务；[`cocos-content-stress-2.4.js`](probes/cocos-content-stress-2.4.js) 在运行时收集阶段数据；[`content-stress-host.js`](../../tools/cocos-agent-bridge/content-stress-host.js) 暴露本地语义命令；纯逻辑测试为 [`cocos-content-stress-2.4.test.cjs`](probes/cocos-content-stress-2.4.test.cjs)。

## Agent 命令合同 0.2

2.4 源码中的扩展目录、Host schema、调度器和 MCP 工具已更新为 `content.stress.run` 合同 0.2，自动化合同测试通过。**运行中的 MCP Creator 实例尚未接受新目录：最近查询返回 `CAPABILITY_CATALOG_INVALID`，因此新版命令没有经真实 MCP/LLM 执行。** 运行前必须查询精确实例和能力目录，只能在命令显示可用时继续。工具写入诊断 JSON 与截图，但不改构建、场景或 release 指针。

必填输入：`buildId`、`resourcePaths`、`parseFixturePaths`、`failureResourcePath`、`cycles`、`nodeCount`、`packable`、`profileId`、`loadMode`、`budgetProfileId`、`budgets`。所有资源必须出现在指定构建的 built-in `resources` config，UUID 唯一；压力纹理与解析夹具分开。PNG 至少 512×512，编码文件至少 256 KiB；每项记录尺寸、位深、颜色类型、字节数、SHA-256 与按 `width × height × 4` 得出的 RGBA 工作集估算。故障路径必须是解析夹具之一。限制为 2–16 个压力资源、2–16 个解析夹具、8–256 轮、32–1024 个 Sprite 节点。

唯一档案为 `macos-arm64-chrome-headless-swiftshader-1280x800`，预算档案 ID 为 `macos-arm64-headless-swiftshader-host-screening-v1`。回执记录主机、架构、OS、CPU、内存、Chrome 版本、SwiftShader 和视口。它只代表开发主机软件渲染筛查，不是物理移动设备数据。所有调用必须显式提供 `targetFps`、`maxColdResourceLoadP95Ms`、`maxWarmResourceLoadP95Ms`、`maxImportParserP95Ms`、`maxPngParserP95Ms`、`maxReleaseCallP95Ms`、`maxEstimatedRgbaWorkingSetBytes`。本机起始筛查值建议为 30 FPS、冷加载 250 ms、热加载 20 ms、import 解析 50 ms、PNG 解析 50 ms、同步释放 8 ms、估算 RGBA 工作集 64 MiB；这些是待实测校准的本机筛查阈值，不是产品设备预算或发布门槛。

每个压力纹理先确认 AssetManager 缓存未命中再测冷加载，立即重复加载并核对对象身份后测热加载；解析夹具另测冷/热加载及实际 `import`/`.png` Parser 回调。每轮还记录 `EVENT_AFTER_DRAW` 间隔、失败时旧画面保留、owner `refCount` 差值、Asset Cache/Bundle Cache 与最终释放状态。PNG 解码纹理的同时驻留规模仅按 RGBA 字节估算，**不是** GPU、Native 或进程实测内存。回执对超预算项给出 `likelyLoci` 和 `nextChecks`；它们是排查方向，不是自动根因判定。缺少冷缓存未命中、Parser 样本或最终释放读回时，结果不得默认通过。

命令完成表示已生成诊断回执；`acceptance.success` 和 `budgetEvaluation.verdict` 才表示验收结果。每个 budget finding 均包含指标、实测值、限制和建议排查方向；`unobserved`/`insufficient-data` 不等于零耗时或通过。

## 合同 0.1 的历史小图探针基线

以下三组数据记录合同建立前的探针行为，测试样本是两张 2×2 PNG，不应当作项目规模基线。旧的默认参数和无预算运行方式已停用；当前运行必须通过 MCP 工具或传入合同要求的完整参数。

## 合同 0.1 历史小图基线（2026-10-10）

以下时间按 Asia/Shanghai 记录；轨迹里的 `testedAt` 使用 UTC。三组都在同一 Creator 2.4.15 Web-Mobile 构建和 Google Chrome headless + SwiftShader 环境运行；每组 48 次替换、49 次资源加载、每轮更新全部节点。资源是项目现有 2×2 PNG；两张均不属于 `helloworld.fire` 的场景引用。阶段统计按 `performance.now()` 的样本计算最近秩 P95。

| Sprite 节点数 | `packable` | `resources.load` P95 | `import` 解析 P95 | PNG 解析 P95 | SpriteFrame 安装 P95 | 节点属性更新 P95 | draw 间隔 P95 | 释放读回 P95 |
| ---: | :---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 32 | true | 3.6 ms | 0.1 ms | 0.3 ms | 0.1 ms | 0.1 ms | 17.0 ms | 16.8 ms |
| 32 | false | 3.8 ms | 0.1 ms | 0.3 ms | 0.1 ms | 0.1 ms | 17.1 ms | 16.8 ms |
| 128 | true | 3.4 ms | 0.1 ms | 0.3 ms | 0.2 ms | 0.0 ms* | 21.5 ms | 21.5 ms |

`*` 时间分辨率和四舍五入后显示为 0.0 ms，意思是这组里样本低于显示精度，不是工作量为零。详细每轮样本、缓存数、引用计数、浏览器帧间隔和 HTTP 状态在三份原始记录中：[32 节点 packable](traces/cocos-agent-content-stress-2.4-web-2026-10-09T16-44-16-343Z-87c796.json)、[32 节点 non-packable](traces/cocos-agent-content-stress-2.4-web-2026-10-09T16-44-42-489Z-c930b1.json)、[128 节点 packable](traces/cocos-agent-content-stress-2.4-web-2026-10-09T16-43-04-938Z-e59143.json)。代表画面：[128 节点正常替换](traces/visual/cocos-agent-content-stress-2.4-2026-10-09T16-43-04-938Z-e59143-after-cycles.png)、[失败后保留旧画面](traces/visual/cocos-agent-content-stress-2.4-2026-10-09T16-43-04-938Z-e59143-failure-retained.png)。

三组都实际对候选 PNG 的 native 文件注入 HTTP 503，2.4 请求重试四次后约 6.0 秒返回 `download failed`。失败后所有临时 Sprite 仍使用原来的 SpriteFrame，原资源仍有效、仍在缓存，显式拥有的 `refCount` 保持为 1。正常清理后，引用降至 0、资源失效并从 Asset Cache 移除，缓存数从起始 29 增至活动期间 30，再回到 29。探针先等节点销毁的 draw，再调用 `releaseUnusedAssets()` 并等下一次 draw 读回；否则延迟节点销毁尚未解除引用时就释放，会得到短暂保留。这个顺序是测试和调用方需要观察的生命周期边界，不是对引擎缺陷的判断。

## 合同 0.1 本机旧命令实测（2026-10-10）

以下记录来自合同 0.2 之前的本地 Host 运行，**不满足当前复杂贴图、冷/热加载和工作集估算要求**，不能作为新版验收结果。

通过 `content-stress-host.js` 对已完成的 `p1-web-20261009` 构建执行了合同输入。设备为 Apple M2 Pro、12 个逻辑 CPU、16 GiB 内存，macOS 25.5.0；浏览器为 Google Chrome 154.0.8037.98 headless + SwiftShader，视口 1280×800。场景压力量是两张 128×128 纯色 PNG，分别 361/360 字节；测试 96 轮资源切换、512 个 Sprite 节点、`packable=true`。两张图在启动场景已被引用，所以资源加载测到的是热缓存路径；两张 2×2 PNG 仅作为独立解析与失败夹具。

| 指标 | 观测 P95 | 本机筛查预算 | 结果 |
| --- | ---: | ---: | :---: |
| 帧间隔 | 18.6 ms（最大 56.1 ms） | 33.33 ms（30 FPS） | 通过 |
| 热缓存资源加载 | 0.2 ms | 100 ms | 通过 |
| 解析夹具资源加载 | 0.4 ms | — | 记录 |
| 导入反序列化 Parser | 0.1 ms | 20 ms | 通过 |
| PNG Parser | 0.3 ms | 20 ms | 通过 |
| 同步释放调用 | 0.1 ms | 8 ms | 通过 |

`import` 共有 3 个回调、`.png` 有 2 个回调；所有解析夹具在释放后均为 `refCount=0`、无效且移出 Asset Cache。压力纹理的 96 次 owner 引用差值都为 1；因启动场景仍持有引用，清理后纹理合法地保持 `refCount=1`、有效、在缓存中。Asset Cache 从 29 到 29，Bundle Cache 为 3。单独对未被场景持有的蓝色解析夹具注入 503，失败后全部 Sprite 保持原画面；预算和生命周期不变量均通过。

完整结构化回执见[轨迹](traces/cocos-agent-content-stress-2.4-web-2026-10-10T02-51-16-679Z-4ffffd.json)；[96 轮完成画面](traces/visual/cocos-agent-content-stress-2.4-2026-10-10T02-51-16-679Z-4ffffd-after-cycles.png)和[失败后保留画面](traces/visual/cocos-agent-content-stress-2.4-2026-10-10T02-51-16-679Z-4ffffd-failure-retained.png)。纯色图与 2×2 解析夹具仍不代表复杂生产贴图；SwiftShader 的通过不能代表目标手机帧率、GPU 或 Native 内存。

## 如何定位阶段

- `resourceLoadTotalMs` 量 `cc.resources.load` 的完整回调延迟，包含资源管理器的下载/缓存与解析路径，不等同于纯网络时间。
- `parse.samplesByType.import` 来自 2.4 `AssetManager.parser.parse` 的 `import` 解析回调。源码 `engine/2.4.15engine/cocos2d/core/asset-manager/parser.js::parseImport` 调用 `deserialize(file, options)`，因此这段覆盖导入 JSON 反序列化；`.png` 项量 `parseImage` 回调，Web 下可能包括图片解码。新命令的解析夹具目前仍是 2×2 PNG，不能推断大图、复杂依赖或冷设备的表现。
- `spriteFrameCreateMs`、`spriteFrameInstallMs`、`nodeMutationMs` 把帧构建、批量切换和节点更新从资源加载中分开。128 节点组没有显示节点写入成本明显增长；安装成本略增，但样本不足以支持引擎优化结论。
- `releaseCallMs` 是同步调用耗时；`releaseObservedMs` 还包含等下一次 `EVENT_AFTER_DRAW` 的时间，不应把约 16–22 ms 全算作释放函数 CPU 成本。`visibleDrawWaitMs` 同样是事件等待，不是 GPU 时间。
- 测试环境的 draw 间隔 P95 约 17–22 ms，最大值出现 60–128 ms 的长尾。Chrome headless、SwiftShader、截图/CDP 与宿主调度都会影响这些观测；没有配置 FPS 门槛，不能据此宣布帧预算通过或失败。

这组数据暂时把热点候选指向“完整资源加载路径”，而非 2×2 PNG 解析、SpriteFrame 创建或节点属性写入；真正的异步失败路径则由重试拉长到约 6 秒。接下来若要作引擎级定位，应在目标设备和正式资源规模上拆分冷/热加载、网络延迟、JSON/依赖规模、纹理解码、节点数与释放策略，并对照同一构建重复运行；阈值应来自目标产品设备与帧预算。

后续用同一构建把失败响应改为确定的 HTTP 404 后确认，旧版也会重试 4 次并等待约 6 秒。2.4 资源下载器源码已增加永久 4xx 快速失败，并保留 408/425/429、5xx 与无状态传输错误的重试；404 的等价运行时补丁测试只发 1 次请求，2.6/3.2 ms 返回，且旧资源和画面保留。503 回归仍为 4 次请求、约 6 秒。源码修改、源码测试和构建来源限制见[HTTP 重试优化案例](content-http-retry-optimization-2.4.md)；正式自定义引擎编译和项目选路尚未完成。

## 证据边界

- 只验证 Creator 2.4.15 Web-Mobile 构建；不代表 Creator 编辑器原位预览、Mac/移动原生、Asset Bundle/远端分发、GPU/Native 内存或真实设备帧时间。
- `performance.memory` 是 Chrome 非标准 JS 堆观测，不是峰值、GPU 显存或纹理字节数。Asset Cache 数含场景和引擎资源，应与同一会话基线比较；逐项纹理 `refCount` 更能核对显式 owner。
- `preload` 阶段记录 API 端到端等待时间，不把它当作纯网络耗时；探针还单独记录它没有调用 Parser 的样本结果，随后 `load` 才测解析。此行为与[2.4 预加载和加载手册](https://docs.cocos.com/creator/2.4/manual/zh/asset-manager/preload-load.html)的说明一致。释放语义参见[2.4 资源释放手册](https://docs.cocos.com/creator/2.4/manual/zh/asset-manager/release-manager.html)。
- 合同 0.2 的 `content.stress.run` 已加入 2.4 扩展目录、Host 调度和 MCP server；目录合同、dispatcher、InMemoryTransport 与 MCP 路由自动测试通过。2026-10-10 使用真实 DeepSeek Agent + MCP stdio 执行了只读实例发现/选择：模型实际调用 `cocos_2x_instances_list`，读到 Creator 2.4.15 实例为 `unavailable`、`extensionVersion=null`、`CAPABILITY_CATALOG_INVALID`；随后模型请求 `cocos_2x_instances_get`，调度器因实例不 ready 在调用 MCP 前阻止，并安全停止。未查询能力目录或调用写工具。运行 ID `fa223622-2ada-40d8-a0e0-fbac5c252d26`，本地原始轨迹保存在项目忽略目录 `.cocos-agent/agent-runs/2026-10-10T14-09-01-747Z-cb46d923.jsonl`。因此真实 LLM→MCP 调度的安全停止分支已验收，但没有经活动目录调用合同 0.2 的压力命令。复杂 PNG 冷/热加载、工作集估算以及新版性能回执尚无运行轨迹；旧合同本机筛查结果不能替代这些验收。当前产品路径仅 Creator 2.4.15 Web-Mobile/Chrome headless。

本页的三组基线仍只适用于 Web-Mobile。阶段 5 的 Mac JSB 内存桥接与 1024×1024 远端纹理压力数据另见[原生源码改造案例](native-jsb-memory-bridge-2.4.md)；它补的是原生进程 RSS 的可观测性，不回填本页的 Web 帧时间，也不能把进程 RSS 解释为 GPU/纹理占用。
