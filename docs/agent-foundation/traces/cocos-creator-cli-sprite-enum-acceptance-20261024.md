# Cocos Creator CLI `cc.Sprite.type` 枚举验收（2026-10-24）

本记录验证 Creator 2.4.15 场景组件 `cc.Sprite.type` 的枚举写入、CLI 关闭/重开读回和补偿恢复。全程通过 Cocos CLI/MCP 命令完成，没有使用桌面 UI 自动化。

## 身份与基线

- 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`
- Creator：`2.4.15`；扩展：`0.8.74`
- 场景：`CliAcceptanceScene`，UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`
- 节点：`CliSpriteTest`，UUID `98b06a8e-b138-495f-9a9f-e411b40a6c42`
- 组件：`cc.Sprite`，实例 ID `46UtKj7o1MmYHyjvCPMcWI`
- Inspector 枚举：`SIMPLE=0`、`SLICED=1`、`TILED=2`、`FILLED=3`、`MESH=4`
- 基线：`type=0`；场景 SHA-256 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`；`.meta` SHA-256 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`

## 写入与重开读回

1. CLI 计划 `fdeafa94-aef3-4e1c-ba85-f701ab94ad97`（计划哈希 `c4e1da47f7f130898d54b3b959208a9e6bf9d04630271b5cf940df9b5796ce4c`），将 `type` 从 `0` 改为 `1`。提交完成，磁盘 `_type` 精确读回 `1`；新场景 SHA-256 为 `8c358a6fc3d53cd0b5830427a7543b52b7c501f3c34e546642ad06b9d0a358ce`，`.meta` 不变。
2. CLI 关闭该工程，回执为 `closed=true`、`processExited=true`。随后 CLI 重开，报告同一绝对工程路径、Creator `2.4.15`、扩展 `0.8.74` 和新实例 `e8f0c45a-7aca-45b9-9fda-d8f62a0e9cc2`。`creator.scene.ui.inspect` 读回枚举 `SLICED=1`，磁盘对应组件 `_type` 亦为 `1`。

## 补偿与最终核验

1. 在重开实例中，CLI 为同一组件计划补偿 `be5ba1dd-e2db-422c-9cf0-239db044267f`（计划哈希 `83e4aa257cd5f8ae4a6ec2e27bb037a9e2ab4b7e283463ba9ba8c1e39582c30e`），将值由 `1` 恢复为 `0`。提交回执确认磁盘 `_type=0`，场景 SHA-256 回到基线。
2. CLI 再次关闭并重开，实例 `ea25f1af-b9c7-4d43-be86-4f021159ea40` 的工程身份和活动场景正确。Inspector 读回 `type=0`，磁盘 `_type=0`；`materials` 仍为基线的一项 Material UUID。最终 `.fire` 和 `.meta` 哈希均等于记录基线。

## 结论与边界

已验证 CLI 可按 Creator Inspector 声明枚举写入 `cc.Sprite.type`，经完整工程关闭/重开后保持一致，并可按精确反向值补偿。夹具没有 SpriteFrame，因此本验收只证明枚举序列化和重开读回，不声称验证 Sliced 渲染效果。
