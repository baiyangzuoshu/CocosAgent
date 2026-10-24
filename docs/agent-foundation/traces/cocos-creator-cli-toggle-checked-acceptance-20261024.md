# Cocos Creator CLI `cc.Toggle.isChecked` 属性验收（2026-10-24）

本记录验证 Creator 2.4.15 `cc.Toggle.isChecked` 布尔属性的写入、CLI 关闭/重开读回、补偿和二次重开恢复。所有操作通过 Cocos CLI/MCP 完成。

## 身份与基线

- 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`
- Creator：`2.4.15`；扩展：`0.8.74`
- 场景：`CliAcceptanceScene`，UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`
- 节点：`CliToggleTest`，UUID `eb41dab0-5804-4a18-a002-d67a47115558`
- 组件：`cc.Toggle`，实例 ID `e9W1GquM9FyaPcXkeZQWx5`
- 属性：`isChecked` → `_N$isChecked`
- 基线：`isChecked=false`；`checkEvents` 为现有 `toggle-cli-test` 回调
- 场景 SHA-256：`cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`
- `.meta` SHA-256：`269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`

## 写入、重开和补偿

1. CLI 计划并提交操作 `411e4d6f-32ae-4861-9b76-6097f8c8da80`（计划哈希 `be1829add8fa16808d9c60b6b34a3c3ec42e2856fb2aef48869f09643897f7bc`），将 `isChecked` 从 `false` 设为 `true`。回执确认 `_N$isChecked=true` 写回，场景 SHA-256 变为 `41c0d102c1b4c82805f64695b89e88fd589c2fcdd37d6666048235f8f0b2c365`。
2. CLI 关闭工程（进程退出）并重开；实例 `6e0e2b55-208e-41cd-a910-f0066b8da330` 报告正确工程路径、Creator 版本和活动场景。`creator.scene.ui.inspect` 读回 `isChecked=true`，原 `checkEvents` 保持不变。
3. CLI 计划补偿 `55c09dd1-0953-4f72-9502-f7178a278e98`（计划哈希 `4537461335fcecde557317c405b775d6152ce0743a4f3bcc085aacecbbcd7b39`），恢复 `false`。提交回执确认 `_N$isChecked=false`，场景和 `.meta` 哈希回到基线。
4. 再次通过 CLI 关闭并重开，最终实例 `51da7a44-5419-40dd-9b2c-5650c93cbedb` 的 Inspector 读回 `false` 和原 `checkEvents`；最终 `.fire`/`.meta` 哈希与基线一致。

## 结论与边界

已证明 `isChecked` 可通过通用 CLI 组件属性写入、持久化、重开读取和补偿。用户点击切换并触发 `checkEvents` 的运行时证据单独记录于 [Toggle 事件验收](cocos-creator-cli-toggle-event-acceptance-20261024.md)；本记录不重复声称运行时行为由属性 setter 验证。
