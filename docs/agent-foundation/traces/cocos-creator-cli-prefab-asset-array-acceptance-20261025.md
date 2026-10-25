# Prefab Material 数组资源引用往返验收（2026-10-25）

## 范围

- 工程：Tank，`/Users/youjunmao/WORK/Cocos_Engine/tank`
- Creator：2.4.15
- CLI：0.12.62
- Creator 扩展：0.8.109
- 操作入口：独立 Cocos CLI / Creator 扩展；未使用电脑 UI 操控。
- 验收字段：`db://assets/Button.prefab` 根节点 `cc.Sprite.materials`，只验证 Material 类型的 AssetDB 引用数组。

这是一项针对单个属性和单种资源类型的闭环验收，不代表 Prefab 数组属性或 Inspector 值类型已普遍覆盖。

## 基线

Prefab UUID：`b657e4bb-78f2-4ba4-b066-600ffb10e4f2`。数组原有一个 Material 引用，UUID 为 `eca5d2f2-8ef6-41c2-bbe6-f9c79d09c432`。

| 文件 | SHA-256 基线与最终值 |
| --- | --- |
| `assets/Button.prefab` | `145fe80ab8a84e7161f7721628373a18292b72ba6410d8a391992048b91465dd` |
| `assets/Button.prefab.meta` | `c926c945705ee5f8ef09f855d8b451392d8744cdb1238a3f8783f7098990a29a` |
| `assets/scene/CliAcceptanceScene.fire` | `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593` |
| `assets/scene/CliAcceptanceScene.fire.meta` | `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba` |

## 发现与修复

在扩展 0.8.108 上，追加数组元素的首次实验落盘后回执进入 `OPERATION_RECONCILIATION_REQUIRED`。源文件只多出一个重复 UUID；`.meta` 未变化。CLI 通过来源补偿将源文件恢复到基线，并关闭、重开工程后确认恢复状态。

原因是 Prefab 磁盘读回验证仅使用 `diff.before` 作为数组元素类型模板。新增索引不存在于 before 数组，导致被读回的资产对象缺失 `assetClass`，与计划的声明类型不匹配。修复后的读回逻辑在 before 对应项不存在时取 after 的类型模板，并保留现有数组项的严格类型校验。

新增自动化回归：`Prefab source readback preserves declared asset types for newly appended array references`。该用例在修复前失败、修复后通过。扩展版本升至 0.8.109，并在 Tank 工程通过仓库 CLI 更新安装与重新握手确认。

## 实机往返

追加操作计划 ID：`352c1ee3-1ff5-4951-94ce-62b4fff2c90b`；计划哈希：`5a6d7b2e039d552f2e328bcf2374bcdac3f8d7dab2efc437dd703e8a5851d184`。提交任务 ID：`5a01e9c1-69f3-478c-90c4-f904673925f7`。Creator 保存与退出/重开完成后，磁盘读回确认 `materials` 从 1 项变为 2 项，两个元素均为目标 Material UUID，Prefab UUID 不变。

按来源派生的补偿计划 ID：`89130e9a-ebeb-4d05-b6f1-7510366bed9e`；计划哈希：`ee394c841f61aeb26bfb737ca4dab0a6be168b6d1269badfa9983e176499c2cb`；提交任务 ID：`bb9c3189-8f2d-4bd5-b4c2-c25975bb8675`。补偿后 CLI 关闭并重开整个 Tank 工程；重新检查 Prefab 源和 Inspector 编辑态，确认 `materials` 恢复单项且该项类型为 Material，Prefab UUID 与 `.meta` UUID/哈希保持不变。所有上述源文件哈希均精确回到基线。

## 回归

- `npm test`：369/369 通过，0 失败。
- `git diff --check`：通过。
- Creator 工程身份和版本通过 CLI 核对；最终工程关闭/重开由 CLI 完成。
- 未覆盖：其他组件的资源数组、其他资源类、数组替换/重排/删除、非数组资源属性以外的任意 Inspector 类型，以及运行时视觉变化。
