---
name: cocos2-asset-bundle-content
description: Stage, build, preview, recover, and roll back local PNG Asset Bundle releases through CocosAgent for Cocos Creator 2.4.15 Web-Mobile.
---

# Creator 2.4 Asset Bundle 内容

只用于 Creator **2.4.15**、本地 PNG Bundle 和 `web-mobile`。先读[内容合同](../../content-bundle-web-0.1.md)、[切片与证据边界](../../cocos2-asset-bundle-slice-plan.md)，以及官方[Asset Bundle 配置与加载手册](https://docs.cocos.com/creator/2.4/manual/zh/scripting/asset-bundle.html)。不要将此 skill 用于 Creator 3.8、外置/远程下载、小游戏、JSB 或原生。

先调用 `content.bundle.plan`；确认 Bundle 文件夹 `.meta`、Bundle 名、PNG 字节摘要、Texture UUID 和唯一 SpriteFrame UUID 均符合预期。只有用户目标 Bundle 名尚未被另一 release 占用且计划结果明确时，再调用 `content.bundle.stage`。该步骤只保存不可变清单，不隐式选择或构建。

若资源或 `.fire` 文件是通过文件系统新生成到项目 `assets/` 下，先查询 `asset.refreshFolder` 能力，并只对目标目录执行一次 `asset.refreshFolder`（`folderPath` 相对 `assets/`）。检查变更回执，再读回 `.meta`、AssetDB UUID 和构建输出；该命令会触发 Creator 导入，不代表构建或运行时验收已经通过。它当前仅 2.4.15 可用。

选择 release 前先读取当前指针并传入 `expectedCurrent`。继续用新的 `buildId` 执行 `content.build.plan` 和 `content.build.execute`；只有 `content.build.get` 为 `completed` 且包校验为 `verified` 才能开始预览。包检查应匹配 Bundle config、两类 UUID、SpriteFrame 对 Texture 的 import 依赖和 PNG native 文件。

调用 `content.preview.start` 后，在本机浏览器打开 URL，再用 `content.preview.get` 分别查看 `buildReleaseId`、当前 `selectedReleaseId`、最近运行时的 `effectiveReleaseId` 和最后回执。需看到 `runtime-observed`，并检查实际画面。`retained`/`needs-review` 代表候选加载失败，当前帧与旧 effective 保留；不要自动重试。修复问题后显式选择另一个 release，再选择目标 release，确认新的 applied 回执后再继续。需要恢复时调用 `content.rollback`，随后等待运行时旧 release 的应用回执，并核对 selected/effective 一致。

Creator 2.4 会按 Bundle 名缓存对象。同名 Bundle 的已有缓存不会被新的版本参数替换；保持 release 的 Bundle 名唯一。新帧绘制确认前不得移除旧 Bundle 或减少旧纹理引用。`removeBundle` 只移除 Bundle 缓存；资源释放依赖纹理引用、SpriteFrame 生命周期与 AssetManager 清理，不能将二者视为同一个动作。

## 并行 Bundle 的诊断规则

不同 Bundle 的资源仍进入同一个 AssetManager Asset Cache。对于无共享依赖的唯一 Texture，先分别加载 Bundle 与资源、`addRef()` 持有，再在目标 Sprite 不再使用后将本次持有计数降到 0；核对 UUID、路径和类型后调用该 Bundle 的 `release`，最后才 `removeBundle`。释放一侧后必须读回另一侧的 Bundle 与 Texture 仍有效，再检查全部释放后 Bundle/Asset 缓存回到会话基线。双独立 PNG Bundle 的两种卸载顺序已在 Web-Mobile 验证，见[双 Bundle 轨迹](../../traces/cocos-agent-multi-bundle-residency-2.4-web.json)和[探针](../../probes/cocos-bundle-residency-2.4.mjs)。

**共享依赖运行状态：局部验证。** Creator 2.4.15 Web-Mobile 构建中，两个 Bundle config 都声明 `deps: ["resources", "internal"]`，同一 SpriteFrame UUID 重定向到 `resources`。预加载 `resources` 后，两个 Bundle 场景反序列化得到同一个 SpriteFrame 对象；SpriteFrame 的原始 `_texture` 指向 Asset Cache 中唯一的源 Texture 对象。两侧场景同时加载时 SpriteFrame `refCount=3`、Texture `refCount=2`。探针分别按 Smoke→Sidecar 和 Sidecar→Smoke 调用 `releaseAll()`、`removeBundle()`；被卸载 Bundle 从 Bundle Cache 移除，另一 Bundle 暂留，共享对象始终有效并在 Asset Cache。每种顺序中，先后运行的两个场景均有可见红色 Sprite 截图，且 Bundle 全部移除后第二个场景仍可见。Asset Cache 在该探针基线及两个 Bundle 加载/卸载后均为 29；释放探针持有后为 27。Bundle Cache 为 3→5→3。证据见[共享依赖轨迹](../../traces/cocos-agent-shared-bundle-dependency-2.4-web.json)、[首场景截图](../../traces/visual/cocos-agent-shared-bundle-cycle-1-first-scene.png)、[首轮卸载后截图](../../traces/visual/cocos-agent-shared-bundle-cycle-1-second-scene.png)、[反向首场景截图](../../traces/visual/cocos-agent-shared-bundle-cycle-2-first-scene.png)、[反向卸载后截图](../../traces/visual/cocos-agent-shared-bundle-cycle-2-second-scene.png)和[探针](../../probes/cocos-bundle-shared-dependency-2.4.mjs)。

保留两项证据限制：两个源 `.fire.meta` 的 `autoReleaseAssets=false`，探针为观察自动依赖释放而在运行时临时将 Scene 对象改为 `true`，所以没有验证源设置 `false` 的切场景回收。Cocos 2.4.15 没有公开的 `SpriteFrame.texture` 属性；探针读到的 `frame._original._texture` 是源 Texture，而 `frame._texture` 是可能由动态合图替换的渲染纹理对象，其 UUID 可为空。本次同时核对了源 Texture 身份、渲染纹理已加载、后端纹理对象存在、Sprite 启用状态和四张可见截图。资源 Bundle 加载前的高优先级依赖错误分支也未实测；只验证了预加载 `resources` 的正向顺序。官方关于优先级和 `releaseAll` 的说明及源码分析见[切片计划](../../cocos2-asset-bundle-slice-plan.md)。

**验证状态：** Creator 2.4.15 Web-Mobile 已实测 plan/stage、隔离构建、Texture/SpriteFrame 身份校验、运行时按需加载和画面替换、缺少 Bundle PNG 时 404/`retained` 并保留旧画面、恢复文件后的显式重选、跨 Bundle 与 built-in resources 的回滚，以及两个独立 Bundle 和共享 `resources` 依赖的双向卸载路径与可见性。共享资源在源设置 `autoReleaseAssets=false` 下的切场景自动释放、consumer Bundle 未预加载高优先级依赖时的拒绝分支、Asset Bundle 重启恢复、逐帧耗时/峰值内存、外置 Bundle、原生和 3.8 未验证；详情见[单次切换轨迹](../../traces/cocos-agent-asset-bundle-host-2.4-web.jsonl)、[多 Bundle 轨迹](../../traces/cocos-agent-multi-bundle-residency-2.4-web.json)和[共享依赖轨迹](../../traces/cocos-agent-shared-bundle-dependency-2.4-web.json)。
