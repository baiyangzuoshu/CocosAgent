# Cocos Creator CLI `cc.Button.normalColor` 颜色属性验收（2026-10-24）

本记录验证 Creator 2.4.15 场景 `cc.Button.normalColor` 的 Color 类型写入、关闭/重开读回和补偿。操作仅经 Cocos CLI/MCP 完成。

## 身份与基线

- 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`
- Creator：`2.4.15`；扩展：`0.8.74`
- 场景：`CliAcceptanceScene`，UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`
- 节点：`Button`，UUID `96907646-d467-4b3b-8870-e0bc076a31fb`
- 组件：`cc.Button`，实例 ID `3d1llAKgFLw57rn9Rk7L7m`
- 属性：`normalColor` → `_N$normalColor`
- 基线颜色：`(255,255,255,255)`；场景 SHA-256 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`
- `.meta` SHA-256：`269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`
- Button 既有事件：目标 `96907646-d467-4b3b-8870-e0bc076a31fb`，组件 `CliAcceptanceButtonState`，handler `onClick`，custom data `cli-test`

## 写入与重开读回

1. CLI 计划 `b6b40b96-bdac-4edc-b911-ce71f1c9a639`（计划哈希 `5235d94e8bf04d07ffaf793d4b2d509229dc8eb249eb9e59372be47368993a6e`），将颜色设为 RGBA `(170,85,255,190)`。提交回执确认 `_N$normalColor` 精确读回；写入后的场景哈希为 `f2e74a536fe5d7b7a53a0cb3d83420f2d1e48ce78ed481ce47c5aa6c8a054429`，`.meta` 不变。Button 点击事件在回执中保持原目标、组件与 handler。
2. CLI 关闭并重开 `tank`；新实例 `9b4bc7b6-4a7b-43d7-8c0b-4cec6c0dfb41` 报告正确工程路径及 Creator 2.4.15。Inspector 读到 RGBA `(170,85,255,190)`，磁盘 `_N$normalColor` 读回相同四通道值。

## 补偿与最终核验

1. 重开后的 CLI 计划 `1a0808df-2646-470d-8d31-ad71ef2ff098`（计划哈希 `f8ef85875339d9344823da6cf842f4b3a1c1daf45295ba43d089f3682de7da51`），将颜色恢复为 `(255,255,255,255)`。提交回执确认磁盘值和场景哈希均回到基线；Button 点击事件读回仍为原有目标、组件和 handler。
2. CLI 再次关闭并重开，实例 `74ef3d96-23f6-4f59-8825-77963656e05f` 的工程身份和活动场景正确。Inspector 和 `.fire` 均读回白色基线；最终场景及 `.meta` 哈希与基线相同。

## 结论与边界

已验证 CLI 对 Button 公开 Color 属性的 Inspector 编码、Creator 保存、关闭/重开读回和补偿。该测试中的 Button `transition` 为 `NONE`，故颜色字段的实际渲染效果没有在本轮断言；矩阵将该行为保留为后续项。
