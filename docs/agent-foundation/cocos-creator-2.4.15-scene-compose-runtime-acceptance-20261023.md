# Creator 2.4.15 场景组合运行时验收

日期：2026-10-23；工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`；Creator：2.4.15；第三方扩展：0.8.26

## 验收目标

验证 Creator 2.4.15 的场景组合计划能否识别已保存场景，并将 AssetDB 场景资源 UUID 与 `.fire` 中 `cc.Scene._id` 分开处理。计划场景为 `db://assets/CliAcceptanceScene.fire`，AssetDB UUID 为 `2c12110c-6f11-4a89-bcd4-1941dc757ca4`，序列化根对象 UUID 为 `d5rwnWLmJLdpdcD4dDbCdC`。

## 改动前后的运行结果

改动前，扩展 0.8.25 在该工程中执行相同场景计划时返回 `SCENE_ASSETDB_IDENTITY_UNAVAILABLE`。当时运行时报告的 `sceneUuid` 是 AssetDB UUID，而 `.fire` 根对象 `_id` 是另一 UUID；实现将两者误认为同一身份，因此没有生成计划，也没有写入场景。

改动后，扩展 0.8.26 在同一 Creator 2.4.15 工程和活动场景上成功生成计划。回执同时返回 AssetDB UUID、根对象 UUID、场景 URL 和 `.fire/.meta` 哈希。计划包含两个节点、三个组件及一个 Button 事件，状态为 `planned`。随后又创建一份相同输入的独立计划，用于验证提交后的过期计划拒绝路径。

| 阶段 | 结果 | 证据 |
| --- | --- | --- |
| 0.8.25 运行时计划 | 失败且未写入 | `SCENE_ASSETDB_IDENTITY_UNAVAILABLE` |
| 0.8.26 运行时计划 | 成功 | 操作 `4e083ac0-1638-4c25-844b-029cf8b41f06`，计划哈希 `7b8f87e3ec65f3a3c01003f60c3fe9548cffd5153ff389fc2f376e89c04b79ae` |
| 0.8.26 重复计划 | 成功 | 操作 `46ab3ff6-a597-4edc-b3ff-057ddcb2ed62`，计划哈希 `4ab749eb2081dcdf6527ba91c1569e42d762cc2f0ef6061ed4a71528147b0bd9` |
| 提交与保存 | 未完成 | Creator 命令返回 `CREATOR_COMMAND_TIMEOUT`，未取得完成回执 |

## 保存状态与限制

提交超时后，场景 `.fire` 的 SHA-256 仍为 `6544ae87a8b91a04baa05e16298223e187e96f113f28855685f2e17c877d4b04`，`.meta` 的 SHA-256 仍为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`，与计划前哈希一致。桥接实例随后断开，因此本次未完成原生审批、场景提交后的实时回读、重开场景验收或脚本 AssetDB 重导入；不将它们标记为通过。

单元测试覆盖了根 UUID 与 AssetDB UUID 分离、保存场景语义校验、旧计划失效、取消状态保持以及不重复保存的恢复路径。完整 CLI 测试结果为 204/204 通过。未启动游戏预览。
