---
name: cocos2-scene-sprite-batch
description: 在 Cocos Creator 2.4.15 中，将多个已导入 PNG 的 SpriteFrame 顺序放入当前场景 Canvas，并逐项验证、补偿或重放。仅适用于本仓库 CocosAgent 的 2.4.15 路径。
---

# Creator 2.4.15 多 Sprite 场景批次

此 skill 只适用于 Creator 2.4.15。2.4 手册规定图像资源导入和 SpriteFrame 引用方式，Canvas 是 UI 根节点：[图像资源](https://docs.cocos.com/creator/2.4/manual/zh/asset-workflow/sprite.html)、[Canvas](https://docs.cocos.com/creator/2.4/manual/zh/components/canvas.html)、[节点变换](https://docs.cocos.com/creator/2.4/manual/zh/content-workflow/transform.html)。本批次只编排现有 `scene.pngSprite`，不创建 Canvas，也不适用于 Creator 3.8。

## 调用流程

从仓库根目录使用 `tools/cocos-agent-bridge/agent-jsonl.js` 的 JSONL 方法。将目标明确为 `{projectRoot: <绝对路径>, creatorVersion: "2.4.15"}`，并在 `targets` 中只列出该项目一次。先调用 `instances.get` 与 `capabilities.list` 确认实际目标和 `scene.pngSprite` 可用，再调用 `scene.sprites.plan`。

1. `plan` / `execute` 的 `assets` 为 2–16 个、已导入 `assets/resources/` 下的 PNG 文件名；每个文件必须有 Creator 生成的 `.meta`，且其中 Texture UUID 与单个 SpriteFrame 子资源关系有效。不要传源路径，也不要在这个批次里做导入。
2. 检查 `plan` 的场景、Canvas、节点冲突和坐标结果；只有 `outcome=ready` 才调用 `scene.sprites.execute`。需要同屏展示多个资源时，传入与 `assets` 顺序一一对应的 `positions`，例如 `[{"x":-64,"y":0},{"x":64,"y":0}]`。坐标是 Canvas 本地设计像素，原点位于中心，限制 ±4096；只设置节点锚点，仍要从本次预览确认图像实际可见。保存返回的 `batchId` 和每项 `operationId`。
3. `needs-preview` 表示场景已保存和读回，但视觉验证未通过。观察本次 2.4 Web 预览；若同屏多张图均可见，可基于同一画面分别为每项调用 `preview.accept`，随后 `scene.sprites.get`；只有所有项均有 `preview=passed` 且批次为 `completed` 才报告成功。
4. 对 `failed` 检查逐项状态和补偿结果。对 `needs-review` 停止自动重试；调用 `scene.sprites.get`、`operation.get` 并读场景，确认实际状态后再决定补偿。
5. 授权撤销时，对状态可确定的批次调用 `scene.sprites.compensate`，要求每项 `disk=passed`、`recovery=passed`，并读回确认 Agent 节点已消失。`scene.sprites.replay` 只用于已完全补偿的批次；它生成新的 batch/operation ID。

批次记录保存在项目 `.cocos-agent/scene-batches/`，单项操作仍使用通用六阶段记录。不能把单项历史回执改写成成功的恢复；恢复有单独的新操作。

## 重要限制

不传 `positions` 时既有单图命令会把所有 Sprite 放在 Canvas 原点，因此多张图会重叠。当前位置能力支持显式设点；不计算自动布局，也不能仅凭场景里出现一个 Sprite 就判定全批预览通过。2.4.15 双图同屏位置、磁盘读回、预览回执及补偿已有实机轨迹，见 `docs/agent-foundation/scene-sprite-batch-0.1.md`。
