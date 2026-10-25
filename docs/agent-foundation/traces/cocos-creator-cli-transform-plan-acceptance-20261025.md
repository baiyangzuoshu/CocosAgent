# Creator CLI 节点变换计划边界验收（2026-10-25）

## 目标与身份

- 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`
- Creator：2.4.15；CLI：0.12.59；扩展：0.8.104
- 场景：`CliAcceptanceScene`，scene UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`
- 节点：`CliProgressBarTest`，node UUID `60b93f4f-8329-4619-83c5-365bbf50e9df`
- 基线场景 SHA-256：`6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`
- 基线 `.meta` SHA-256：`269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`

## 修复和验证

1. 扩展 `createSceneNodeTransformPlan` 现在先校验变换字段，再过滤与当前值完全相同的字段。若没有剩余变化，在计划阶段返回 `SCENE_NODE_TRANSFORM_NO_CHANGE`，不创建 operation、不保存场景。
2. CLI 单元测试覆盖混合变更（保留实际变化、排除未变化字段）和全无变化（计划拒绝且不写场景）。`node --test test/script-modify.test.mjs` 通过，54/54；完整 `node --test --test-reporter=dot` 通过。全量测试需要允许测试进程绑定本机回环地址。
3. Creator 2.4.15 实机对 `{x:250,y:210,anchorX:0.5}` 发起全无变化计划，返回 `SCENE_NODE_TRANSFORM_NO_CHANGE`，operation `bb4848a7-97c1-41b3-ae4c-4c91dbc67d26`；场景文件未改变。
4. 混合计划 `{x:251,y:210,anchorX:0.5}` 仅把 x 纳入计划：operation `539f2891-c996-45f3-a9bb-402fd70deb3b`，plan hash `c963cc14f336b58f4b3c60f68662b9be5e15fae1bb2754f2a95908f3695d7659`。CLI commit `494fcc1a-4e14-4ec6-b4d5-91274e510a0b` 完成并确认磁盘保存；随后 CLI 来源补偿将 x 恢复至 250。
5. CLI 关闭并重开同一工程。重开后握手报告 Creator 2.4.15、扩展 0.8.104、工程路径和活动场景一致；场景快照为 23 个节点，`.fire` 与 `.meta` 哈希均回到基线。

全程通过 Cocos CLI/MCP 与 CLI 的 Creator Preview 接口操作，没有使用桌面 UI 自动化。

## 结果边界

Creator 2.4.15 的场景变换计划对未变化字段已具备明确、可验证的处理：混合输入只提交实际变化字段，全无变化输入在计划阶段拒绝。CLI 提交、磁盘读回、来源补偿和关闭/重开恢复均通过。
