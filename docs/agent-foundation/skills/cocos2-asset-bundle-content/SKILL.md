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

**验证状态：** Creator 2.4.15 Web-Mobile 已实测 plan/stage、隔离构建、Texture/SpriteFrame 身份校验、运行时按需加载和画面替换、缺少 Bundle PNG 时 404/`retained` 并保留旧画面、恢复文件后的显式重选，以及跨 Bundle 与 built-in resources 的回滚。真实预览结束后静态服务与运行时 Host 已停止。进程重启恢复、直接 Bundle 缓存读回、内存基线、外置 Bundle、原生和 3.8 未验证；细节见[运行轨迹](../../traces/cocos-agent-asset-bundle-host-2.4-web.jsonl)。
