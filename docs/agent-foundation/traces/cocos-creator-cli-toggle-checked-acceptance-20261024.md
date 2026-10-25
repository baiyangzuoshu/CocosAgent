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

## Sprite checkMark 可视交互验收补充（2026-10-25）

- 工程仍为 `/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 2.4.15、扩展 0.8.103、CLI 0.12.59；场景 UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`，Toggle 节点/组件 UUID 与上方记录一致。
- 通过 AssetDB 导入临时透明勾号贴图，导入 operation `a32e69b7-def7-494c-9172-0ed79918fea8`，贴图 UUID `cad3e222-7ab7-4190-a5c5-b04f45e6f76e`，SpriteFrame UUID `85a3ae91-9cbd-4a8f-9a21-eeb08d023aeb`。Creator CLI 场景组合 operation `a9fbfbd3-7756-4a7c-9fa0-c5e81d0fed23` 新建 Sprite 子节点 `CliToggleCheckMarkTmp`（UUID `3f73feeb-8b35-4253-b8d0-47b33d16aec0`）；`checkMark` 引用 operation `36ea96c9-db44-446a-af55-45406823ee2c` 精确绑定到该 Sprite 组件。
- Preview 首次读到 `isChecked=false`，但新子节点默认仍 `active=true`；Creator 2.4.15 在加载场景时没有自动按初始 Toggle 状态同步该 `checkMark` 节点。通过 CLI 将子节点 `active=false`（operation `dea7cb35-7ce7-4af0-a14d-4a4cd6e7dd5b`）后刷新 Preview。点击 Toggle 位置（归一化画布坐标 x=0.1875、y=0.1719）后，运行时 `isChecked=true` 且 checkMark `active=true`；再次点击后两者均回到 `false`。两轮 `no-errors` 均通过。
- 选中态截图 SHA-256 `8dd635bbe8e27e2af46f0f27088fd22c624c59fad104034aed86e1185ec30799`，Preview 会话 `3b4f6353-59a6-43a9-9816-365fd45a7d39`。截图中透明底白色勾号在选中时可见。
- 通过来源补偿 operation `cb606a18-6f3a-4cf0-bd1e-6bdbb980f7ba` 清空 `checkMark`，CLI 删除 operation `2473c379-d645-4adc-a96c-0c72a02854ea` 删除临时子节点，随后完整引用扫描为 0 后由 AssetDB 删除 operation `11c7b4ad-21de-410c-9d76-68e7919f6c31` 清除贴图及 SpriteFrame 子资源。
- Cocos CLI 关闭 PID 5081 并重开同一工程，Creator 2.4.15 握手成功。重开读回 23 个节点，Toggle `isChecked=false`、`checkMark=null`、无子节点，临时资源 AssetDB 查询为空；`.fire` SHA-256 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`、`.meta` SHA-256 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba` 恢复基线。
- 该实测覆盖 checkMark 可视显隐和鼠标点击，不覆盖 Toggle 背景 Sprite、按压/禁用样式、不同 ToggleGroup 状态或目标设备。所有写入、Preview 点击、截图、关闭和重开均由 Cocos CLI 完成，没有桌面 UI 自动化。
