# Cocos Creator CLI `cc.Sprite.materials` 数组验收（2026-10-24）

本记录验证 Creator 2.4.15 场景组件公开属性 `cc.Sprite.materials` 的 AssetDB Material 数组写入、工程重开读回和来源补偿。全程通过 Cocos CLI/MCP 命令完成，没有使用桌面 UI 自动化。

## 身份与基线

- 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`
- Creator：`2.4.15`；扩展：`0.8.74`
- 场景：`CliAcceptanceScene`，UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`
- 节点：`CliSpriteTest`，UUID `98b06a8e-b138-495f-9a9f-e411b40a6c42`
- 组件：`cc.Sprite`，实例 ID `46UtKj7o1MmYHyjvCPMcWI`
- Material AssetDB UUID：`eca5d2f2-8ef6-41c2-bbe6-f9c79d09c432`
- 基线场景 SHA-256：`cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`
- 基线 `.meta` SHA-256：`269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`
- 基线 Inspector 值：`materials = [Material eca5d2f2-8ef6-41c2-bbe6-f9c79d09c432]`

## 写入、重开与补偿

1. CLI 计划并提交操作 `7376bc51-4868-4e29-b3d7-7b00e0f002e2`（计划哈希 `7817497c9c7c109e057727a5dabce6bc2f7d7711118df102d91cfab36e762dc2`），将同一精确 Material UUID 写入数组两次。Creator 保存读回 `_materials` 两项 UUID；场景 SHA-256 为 `8a44f3a3400f37e35d43f0fe2979fc02b5d2de833e2ec6308c25ac9c8893e9bf`，`.meta` 哈希不变。
2. 之后的来源补偿由新的 Creator 实例 `8f829c3b-6221-4a1e-b3d5-4e687c2bb99f` 执行，表明工程经过 CLI 关闭并重开。补偿操作 `bc0d42f3-9a73-46d9-9447-63224c7a8182` 将数组恢复为基线的一项 Material；提交回执报告磁盘读回与基线场景哈希一致。
3. 再次通过 CLI 打开工程，当前实例为 `9c9f0f95-6ad6-440f-b987-bee83290d07d`。CLI `creator.project.info` 确认工程路径、Creator 版本和活动场景；`creator.scene.ui.inspect` 读到一项 Material，精确 UUID 与基线一致。磁盘 `.fire` 中组件 `_id` 对应的 `_materials` 也只有该 UUID。
4. 最终场景与 `.meta` 哈希分别为 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74` 和 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`，均恢复到基线。

## 结论与边界

在 Creator 2.4.15 的 `cc.Sprite.materials` 上，CLI 支持声明为 `Material[]` 的属性写入精确 AssetDB 引用、保存、关闭/重开读回和来源补偿。此样例用同一 Material UUID 两次，证明数组长度及每个元素的资源类型/UUID 往返；不据此推断所有组件的资源数组、异质数组、空数组或其他资源类都已通过。历史 `cc.Label.materials` 清空数组尝试被 Creator 拒绝，仍按该属性/该值型的失败边界记录。

注：稍后对原操作执行 reconcile 时，结果因当前文件已经被来源补偿恢复而报告 `conflict`；这是对已补偿后的当前状态与原写入目标不相同的分类。原操作记录中的两项 `_materials` 磁盘读回及 SHA-256 仍保留，最终状态另由当前 CLI Inspector 和磁盘哈希核验。
