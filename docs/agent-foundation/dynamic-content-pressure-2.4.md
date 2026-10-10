# Creator 2.4 动态内容压力与性能预算：首个 Web-Mobile 基线

本切片为 Creator 2.4.15 的资源替换建立可复跑测量基线。探针在已有、已验收的 `p1-web-20261009` Web-Mobile 构建中创建临时 Sprite 节点，不改磁盘场景、不改 release 指针；每轮加载红蓝 PNG、创建并安装 SpriteFrame、更新节点位置和缩放、等 `EVENT_AFTER_DRAW`，再释放旧资源。结束时销毁临时节点、释放最后一份显式引用，并读回资源有效性与 Asset Cache。

脚本：[`cocos-content-stress-2.4-live.mjs`](probes/cocos-content-stress-2.4-live.mjs) 驱动不可变构建、无头 Chrome 与本机 loopback 服务；[`cocos-content-stress-2.4.js`](probes/cocos-content-stress-2.4.js) 在运行时收集阶段数据；纯逻辑测试为 [`cocos-content-stress-2.4.test.cjs`](probes/cocos-content-stress-2.4.test.cjs)。运行前需已完成构建记录且构建包含 `cocos-agent-batch-red`、`cocos-agent-batch-blue`。默认 48 轮、32 个节点、`packable=true`：

```sh
node docs/agent-foundation/probes/cocos-content-stress-2.4-live.mjs --cycles 48 --node-count 32 --packable true
```

可选 `--target-fps`、`--max-resource-load-p95-ms`、`--max-import-parser-p95-ms`、`--max-png-parser-p95-ms`、`--max-release-call-p95-ms` 设置调用方的 P95 门槛。默认不设性能门槛；无门槛时结果为 `completed-without-budget-gate`，只代表结构与资源生命周期不变量通过。超过任何已配置门槛会返回 `STRESS_BUDGET_EXCEEDED`。例如 `--target-fps 60` 会把帧间隔 P95 与 `1000/60 ms` 比较。项目没有统一目标设备或 FPS 要求，因此本次没有替用户选择预算。

## 2026-10-10 实测基线

以下时间按 Asia/Shanghai 记录；轨迹里的 `testedAt` 使用 UTC。三组都在同一 Creator 2.4.15 Web-Mobile 构建和 Google Chrome headless + SwiftShader 环境运行；每组 48 次替换、49 次资源加载、每轮更新全部节点。资源是项目现有 2×2 PNG；两张均不属于 `helloworld.fire` 的场景引用。阶段统计按 `performance.now()` 的样本计算最近秩 P95。

| Sprite 节点数 | `packable` | `resources.load` P95 | `import` 解析 P95 | PNG 解析 P95 | SpriteFrame 安装 P95 | 节点属性更新 P95 | draw 间隔 P95 | 释放读回 P95 |
| ---: | :---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 32 | true | 3.6 ms | 0.1 ms | 0.3 ms | 0.1 ms | 0.1 ms | 17.0 ms | 16.8 ms |
| 32 | false | 3.8 ms | 0.1 ms | 0.3 ms | 0.1 ms | 0.1 ms | 17.1 ms | 16.8 ms |
| 128 | true | 3.4 ms | 0.1 ms | 0.3 ms | 0.2 ms | 0.0 ms* | 21.5 ms | 21.5 ms |

`*` 时间分辨率和四舍五入后显示为 0.0 ms，意思是这组里样本低于显示精度，不是工作量为零。详细每轮样本、缓存数、引用计数、浏览器帧间隔和 HTTP 状态在三份原始记录中：[32 节点 packable](traces/cocos-agent-content-stress-2.4-web-2026-10-09T16-44-16-343Z-87c796.json)、[32 节点 non-packable](traces/cocos-agent-content-stress-2.4-web-2026-10-09T16-44-42-489Z-c930b1.json)、[128 节点 packable](traces/cocos-agent-content-stress-2.4-web-2026-10-09T16-43-04-938Z-e59143.json)。代表画面：[128 节点正常替换](traces/visual/cocos-agent-content-stress-2.4-2026-10-09T16-43-04-938Z-e59143-after-cycles.png)、[失败后保留旧画面](traces/visual/cocos-agent-content-stress-2.4-2026-10-09T16-43-04-938Z-e59143-failure-retained.png)。

三组都实际对候选 PNG 的 native 文件注入 HTTP 503，2.4 请求重试四次后约 6.0 秒返回 `download failed`。失败后所有临时 Sprite 仍使用原来的 SpriteFrame，原资源仍有效、仍在缓存，显式拥有的 `refCount` 保持为 1。正常清理后，引用降至 0、资源失效并从 Asset Cache 移除，缓存数从起始 29 增至活动期间 30，再回到 29。探针先等节点销毁的 draw，再调用 `releaseUnusedAssets()` 并等下一次 draw 读回；否则延迟节点销毁尚未解除引用时就释放，会得到短暂保留。这个顺序是测试和调用方需要观察的生命周期边界，不是对引擎缺陷的判断。

## 如何定位阶段

- `resourceLoadTotalMs` 量 `cc.resources.load` 的完整回调延迟，包含资源管理器的下载/缓存与解析路径，不等同于纯网络时间。
- `parse.samplesByType.import` 来自 2.4 `AssetManager.parser.parse` 的 `import` 解析回调。源码 `2.4.15engine/cocos2d/core/asset-manager/parser.js::parseImport` 调用 `deserialize(file, options)`，因此这段覆盖导入 JSON 反序列化；`.png` 项量 `parseImage` 回调，Web 下可能包括图片解码。当前 2×2 PNG 的解析成本很小，不能推断大图、复杂依赖或冷设备的表现。
- `spriteFrameCreateMs`、`spriteFrameInstallMs`、`nodeMutationMs` 把帧构建、批量切换和节点更新从资源加载中分开。128 节点组没有显示节点写入成本明显增长；安装成本略增，但样本不足以支持引擎优化结论。
- `releaseCallMs` 是同步调用耗时；`releaseObservedMs` 还包含等下一次 `EVENT_AFTER_DRAW` 的时间，不应把约 16–22 ms 全算作释放函数 CPU 成本。`visibleDrawWaitMs` 同样是事件等待，不是 GPU 时间。
- 测试环境的 draw 间隔 P95 约 17–22 ms，最大值出现 60–128 ms 的长尾。Chrome headless、SwiftShader、截图/CDP 与宿主调度都会影响这些观测；没有配置 FPS 门槛，不能据此宣布帧预算通过或失败。

这组数据暂时把热点候选指向“完整资源加载路径”，而非 2×2 PNG 解析、SpriteFrame 创建或节点属性写入；真正的异步失败路径则由重试拉长到约 6 秒。接下来若要作引擎级定位，应在目标设备和正式资源规模上拆分冷/热加载、网络延迟、JSON/依赖规模、纹理解码、节点数与释放策略，并对照同一构建重复运行；阈值应来自目标产品设备与帧预算。

## 证据边界

- 只验证 Creator 2.4.15 Web-Mobile 构建；不代表 Creator 编辑器原位预览、Mac/移动原生、Asset Bundle/远端分发、GPU/Native 内存或真实设备帧时间。
- `performance.memory` 是 Chrome 非标准 JS 堆观测，不是峰值、GPU 显存或纹理字节数。Asset Cache 数含场景和引擎资源，应与同一会话基线比较；逐项纹理 `refCount` 更能核对显式 owner。
- `preload` 阶段记录 API 端到端等待时间，不把它当作纯网络耗时；探针还单独记录它没有调用 Parser 的样本结果，随后 `load` 才测解析。此行为与[2.4 预加载和加载手册](https://docs.cocos.com/creator/2.4/manual/zh/asset-manager/preload-load.html)的说明一致。释放语义参见[2.4 资源释放手册](https://docs.cocos.com/creator/2.4/manual/zh/asset-manager/release-manager.html)。
- 这是 Agent 可调用的本地验收探针和可配置预算门槛，不是 MCP/Host 新命令，也没有改动引擎源码或默认运行时行为。只有在拿到产品目标设备数据并明确预算后，才应把它提升为持续回归门禁。

本页的三组基线仍只适用于 Web-Mobile。阶段 5 的 Mac JSB 内存桥接与 1024×1024 远端纹理压力数据另见[原生源码改造案例](native-jsb-memory-bridge-2.4.md)；它补的是原生进程 RSS 的可观测性，不回填本页的 Web 帧时间，也不能把进程 RSS 解释为 GPU/纹理占用。
