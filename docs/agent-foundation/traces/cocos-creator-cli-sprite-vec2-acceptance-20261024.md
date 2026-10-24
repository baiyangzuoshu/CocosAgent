# Cocos Creator CLI `cc.Sprite.fillCenter` Vec2 验收（2026-10-24）

本记录验证 Creator 2.4.15 场景公开属性 `cc.Sprite.fillCenter` 的 Vec2 写入、CLI 关闭/重开读回、补偿和最终基线恢复。全程通过 Cocos CLI/MCP 完成。

## 身份与基线

- 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`
- Creator：`2.4.15`；扩展：`0.8.74`
- 场景：`CliAcceptanceScene`，UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`
- 节点：`CliSpriteTest`，UUID `98b06a8e-b138-495f-9a9f-e411b40a6c42`
- 组件：`cc.Sprite`，实例 ID `46UtKj7o1MmYHyjvCPMcWI`
- 属性：`fillCenter` → `_fillCenter`
- 基线值：Vec2 `(0,0)`；场景 SHA-256 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`
- `.meta` SHA-256：`269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`

## 写入与读回

1. CLI 计划并提交 `f734ab01-a1a7-4642-a2d8-5b990c0d02a9`（计划哈希 `b258b30066b2020493c3ed793b59b5559f36e75f046f7aa79261def8b17aebfc`），将 Vec2 从 `(0,0)` 改为 `(0.25,0.75)`。Creator 磁盘读回 `_fillCenter={x:0.25,y:0.75}`；场景 SHA-256 为 `b6ea28b71d77d1134e8c7ef22019cb1c0b5b9b8ebca8452606306f596bd5c27f`，`.meta` 不变。
2. CLI 关闭工程并报告进程退出，再以 Creator 2.4.15 重开。新实例 `fd61af1b-50c1-4c2c-8890-54eb027e70ab` 的 `creator.scene.ui.inspect` 读到 `fillCenter=(0.25,0.75)`，与磁盘序列化一致。

## 补偿与最终核验

1. 重开实例中，CLI 计划补偿 `c179f2c5-d831-41de-8a80-751d4fb4b50e`（计划哈希 `fbd86e30fbce2768a70ca2e8e74df7be611d4f83798de48f178ca57b58174a23`），恢复 Vec2 `(0,0)`。提交回执确认精确 `_fillCenter` 读回，场景 SHA-256 回到基线。
2. CLI 再次关闭并重开，最终实例 `dc153169-c53d-4ab1-8967-5b5af7fae473` 的 Inspector 读回 `(0,0)`；磁盘 `_fillCenter` 为 `cc.Vec2{x:0,y:0}`。最终场景和 `.meta` 哈希与基线相同。

## 结论与边界

已验证 Creator 声明的 Vec2 Inspector 字段可通过 CLI 写入、持久化、工程重开读回并补偿。测试 Sprite 没有 SpriteFrame，且 `type=SIMPLE`；不据此宣称 `FILLED` 模式的可视填充效果已验收。
