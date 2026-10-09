---
name: cocos2-asset-bundle-content
description: Stage, build, preview, recover, and roll back local PNG Asset Bundle releases through CocosAgent for Cocos Creator 2.4.15 Web-Mobile.
---

# Creator 2.4 Asset Bundle 内容

只用于 Creator **2.4.15**、本地 PNG Bundle 和 `web-mobile`。先读[内容合同](../../content-bundle-web-0.1.md)、[切片与证据边界](../../cocos2-asset-bundle-slice-plan.md)，以及官方[Asset Bundle 配置与加载手册](https://docs.cocos.com/creator/2.4/manual/zh/scripting/asset-bundle.html)。不要将此 skill 用于 Creator 3.8、外置/远程下载、小游戏、JSB 或原生。

先调用 `content.bundle.plan`；确认 Bundle 文件夹 `.meta`、Bundle 名、PNG 字节摘要、Texture UUID 和唯一 SpriteFrame UUID 均符合预期。只有用户目标 Bundle 名尚未被另一 release 占用且计划结果明确时，再调用 `content.bundle.stage`。该步骤只保存不可变清单，不隐式选择或构建。

选择 release 前先读取当前指针并传入 `expectedCurrent`。继续用新的 `buildId` 执行 `content.build.plan` 和 `content.build.execute`；只有 `content.build.get` 为 `completed` 且包校验为 `verified` 才能开始预览。包检查应匹配 Bundle config、两类 UUID、SpriteFrame 对 Texture 的 import 依赖和 PNG native 文件。

调用 `content.preview.start` 后，在本机浏览器打开 URL，再用 `content.preview.get` 分别查看 `buildReleaseId`、当前 `selectedReleaseId`、最近运行时的 `effectiveReleaseId` 和最后回执。需看到 `runtime-observed`，并检查实际画面。`retained`/`needs-review` 代表候选加载失败，当前帧与旧 effective 保留；不要自动重试。修复问题后显式选择另一个 release，再选择目标 release，确认新的 applied 回执后再继续。需要恢复时调用 `content.rollback`，随后等待运行时旧 release 的应用回执，并核对 selected/effective 一致。

Creator 2.4 会按 Bundle 名缓存对象。同名 Bundle 的已有缓存不会被新的版本参数替换；保持 release 的 Bundle 名唯一。新帧绘制确认前不得移除旧 Bundle 或减少旧纹理引用。`removeBundle` 只移除 Bundle 缓存；资源释放依赖纹理引用、SpriteFrame 生命周期与 AssetManager 清理，不能将二者视为同一个动作。

## 并行 Bundle 的诊断规则

不同 Bundle 的资源仍进入同一个 AssetManager Asset Cache。对于无共享依赖的唯一 Texture，先分别加载 Bundle 与资源、`addRef()` 持有，再在目标 Sprite 不再使用后将本次持有计数降到 0；核对 UUID、路径和类型后调用该 Bundle 的 `release`，最后才 `removeBundle`。释放一侧后必须读回另一侧的 Bundle 与 Texture 仍有效，再检查全部释放后 Bundle/Asset 缓存回到会话基线。双独立 PNG Bundle 的两种卸载顺序已在 Web-Mobile 验证，见[双 Bundle 轨迹](../../traces/cocos-agent-multi-bundle-residency-2.4-web.json)和[探针](../../probes/cocos-bundle-residency-2.4.mjs)。

**共享依赖状态：未验证。** 不要把独立资源的结果推广到共享 Texture/SpriteFrame。2.4 官方手册规定不同优先级共享资源归较高优先级 Bundle，加载低优先级 Bundle 前须先加载高优先级 Bundle；`releaseAll` 会覆盖 Bundle 外部依赖。先用真实依赖构建和 Bundle config 证明归属，再分别观察两个消费者释放前后的依赖引用、Asset Cache 与画面；引用关系未查清时，不对共享资源做强制释放或 `releaseAll`。

**验证状态：** Creator 2.4.15 Web-Mobile 已实测 plan/stage、隔离构建、Texture/SpriteFrame 身份校验、运行时按需加载和画面替换、缺少 Bundle PNG 时 404/`retained` 并保留旧画面、恢复文件后的显式重选、跨 Bundle 与 built-in resources 的回滚，以及两个独立 PNG Bundle 的同时驻留和双向释放。Asset Bundle 重启恢复、共享依赖、逐帧耗时/峰值内存、外置 Bundle、原生和 3.8 未验证；详情见[单次切换轨迹](../../traces/cocos-agent-asset-bundle-host-2.4-web.jsonl)和[多 Bundle 轨迹](../../traces/cocos-agent-multi-bundle-residency-2.4-web.json)。
