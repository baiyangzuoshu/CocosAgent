# Cocos Creator CLI `cc.Label.string` 验收（2026-10-24）

本记录验证 Creator 2.4.15 场景 `cc.Label.string` 的文本写入、CLI 关闭/重开读回、补偿和最终基线恢复。操作通过 Cocos CLI/MCP 完成，没有使用桌面 UI 自动化。

## 身份与基线

- 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`
- Creator：`2.4.15`；扩展：`0.8.74`
- 场景：`CliAcceptanceScene`，UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`
- 节点：`CliLabelTest`，UUID `a82641c0-22e3-4ef4-b390-9fd1a7d16a26`
- 组件：`cc.Label`，实例 ID `2fJFZNyLxCd5S6q5DgY7+P`
- 属性：`string` → `_string`
- 基线文本：`CLI Label Validated`
- 基线场景 SHA-256：`cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`
- 基线 `.meta` SHA-256：`269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`

## 写入、重开和补偿

1. CLI 计划并提交操作 `37b97444-516b-4bff-88c8-fc4b603a8735`（计划哈希 `142d28f633ea4d4c80899528e415027f54608c6cc5f964d103055f80eb997922`），将文本改为 `CLI Label Roundtrip`。提交回执确认 `_string` 精确写回；场景 SHA-256 为 `bbe46e0f443dccb904fc98578b6c79bd24a2d3d754da3d79a8c098a980dfd44e`，`.meta` 不变。
2. CLI 关闭工程并确认进程退出，再重开 Creator 2.4.15。新实例 `67b883f5-ec33-4171-bc2e-63280a4709b2` 的 Inspector 读回 `CLI Label Roundtrip`。
3. 重开实例中，CLI 计划补偿 `0e56a31a-cb95-4995-b374-2c1c1c4a2a38`（计划哈希 `011e0ece4001c19dc78bc2eaee8de8330e7759210530d553e78824ecdf3e6592`），恢复原文本。回执确认场景 SHA-256 和 `.meta` 哈希恢复到基线。
4. CLI 再次关闭并重开，最终实例 `fd3fc494-9a92-4bba-ac36-42412542e666` 的 Inspector 与磁盘 `_string` 都读回 `CLI Label Validated`；场景及 `.meta` 哈希均与基线一致。

## 结论与边界

已验证公开 Label 字符串属性可由 CLI 写入、保存、关闭/重开读回并恢复。该项没有采集文本渲染截图，矩阵仍将实际显示效果留作后续验证。
