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

**共享依赖运行与边界：Creator 2.4.15 Web-Mobile 已实测。** 两个 Bundle config 都声明 `deps: ["resources", "internal"]`，共享 SpriteFrame UUID 重定向到 `resources`；两个 Bundle 场景得到同一 SpriteFrame 对象，其原始纹理是 Asset Cache 中唯一的 Texture。两种 Consumer 卸载顺序均保持另一场景画面和共享资源有效，见[共享依赖轨迹](../../traces/cocos-agent-shared-bundle-dependency-2.4-web.json)和[探针](../../probes/cocos-bundle-shared-dependency-2.4.mjs)。

新增边界探针验证：`resources` 未加载且共享 Frame/Texture 不在 Asset Cache 时，Consumer config 可以加载，但通过 Consumer 按 UUID 加载共享 Frame 返回 `Please load bundle resources first`；先加载 owner 后，同一 Frame 和场景加载成功。两个 Scene 运行时 `autoReleaseAssets=false`，未在探针中修改。两份 `.fire.meta` 也为 `false`，但源 `.fire` 的序列化 Scene 字段为 `true`；这个构建加载后的 runtime 值为 `false`，操作前先读取运行时值。切换场景后 Frame/Texture 引用计数降低但资源留在缓存；活动 Consumer 期间 owner `releaseUnusedAssets()` 保留两者。释放/移除 Consumer Bundle、移除 owner Bundle 对象也没有破坏当前活动场景。退出场景后 Frame `refCount=0` 仍可缓存，随后 owner 的 `releaseUnusedAssets()` 清理 Frame 与 Texture。全构建 5 份 Bundle config 扫描显示 Frame/Texture 各由 `resources` 唯一持有，Consumer 与 `main` 的 Frame redirect 指向该 owner。证据见[边界轨迹](../../traces/cocos-agent-shared-bundle-boundaries-2.4-web.json)、[截图](../../traces/visual/cocos-agent-shared-boundary-auto-release-false.png)和[边界探针](../../probes/cocos-bundle-shared-boundaries-2.4.mjs)。

加载 Consumer 的共享资源前必须加载 redirect owner。卸载时先停止 Consumer 新加载并退出使用场景，再核对活动 Consumer、动态引用、`refCount` 和缓存；保留活动引用时只允许非强制 `releaseUnusedAssets()` 路径。不要在共享资源仍使用时调用 owner `releaseAll()`：2.4.15 对 owner 自有根资源执行强制释放。`removeBundle()` 只移除 Bundle config 缓存，不释放已加载资源。合同字段和实现状态见[跨 Bundle 依赖合同 0.2 设计稿](../../asset-bundle-cross-dependency-0.2-design.md)；设计稿尚不是 Host/MCP 已支持的合同。

Cocos 2.4.15 没有公开的 `SpriteFrame.texture` 属性。运行时应区分源纹理 `frame._original._texture` 与可能由动态合图替换的渲染纹理 `frame._texture`，并结合 Asset Cache、`valid`、Sprite 状态和截图确认画面。以上证据仅覆盖本地 PNG SpriteFrame 场景、Creator 2.4.15 Web-Mobile；远端版本交叉、原生内存回收、其它资源类型和 3.8 未验证。官方优先级、Bundle 释放与场景自动释放说明，以及对应源码边界见[切片计划](../../cocos2-asset-bundle-slice-plan.md)。

**验证状态：** Creator 2.4.15 Web-Mobile 已实测 plan/stage、隔离构建、Texture/SpriteFrame 身份校验、运行时按需加载和画面替换、缺少 Bundle PNG 时 404/`retained` 并保留旧画面、恢复文件后的显式重选、跨 Bundle 与 built-in resources 的回滚，以及两个独立 Bundle 和共享 `resources` 依赖的双向卸载、owner 缺席错误与恢复、`autoReleaseAssets=false` 场景切换和安全清理路径。Asset Bundle 重启恢复、逐帧耗时/峰值内存、外置 Bundle、原生和 3.8 未验证；详见[单次切换轨迹](../../traces/cocos-agent-asset-bundle-host-2.4-web.jsonl)、[多 Bundle 轨迹](../../traces/cocos-agent-multi-bundle-residency-2.4-web.json)、[共享依赖轨迹](../../traces/cocos-agent-shared-bundle-dependency-2.4-web.json)和[边界轨迹](../../traces/cocos-agent-shared-bundle-boundaries-2.4-web.json)。
