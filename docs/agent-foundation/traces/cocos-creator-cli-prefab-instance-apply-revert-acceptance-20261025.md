# Cocos Creator CLI Prefab 实例 Apply/Revert 验收（2.4.15）

日期：2026-10-25  
工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`  
Creator：2.4.15；CLI：0.12.60；扩展：0.8.106

## 目标与基线

验证 Prefab 源编辑与场景实例 Apply/Revert 是分开的 Creator-aware 操作，并确认恢复后 UUID、`.meta` 和序列化文件哈希均回到验收前状态。操作均由 Cocos CLI 发起；没有使用桌面 UI 自动化，也没有直接写入 `.prefab`。

- 场景 `CliAcceptanceScene` UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`，原始 SHA-256 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`；`.meta` SHA-256 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。
- 场景实例 `CliBlockInputEventsPrefabInstance` UUID `0e416aa5-e254-47f0-bcd6-4e09a5708abb`，链接 Prefab UUID `21119a83-ebeb-4542-bd8b-b477c2b1f2f5`；`cc.BlockInputEvents` 实例 ID `60DfuOxaJAI4l+CYVkWcd0`。
- Prefab 源 `CliBlockInputEventsTest.prefab` 原始 SHA-256 `189d2ed73c6e021ee48a52fda6bab30c60345cc35bfdbfc3458d062ccb5e9200`；`.meta` SHA-256 `ab6b5fa05f91d463f8a612129bc734a188aedd18e4f33ff4afd52f8157643821`。源根节点原始 `_active=false`，组件 `_enabled=true`；场景实例原始 `active=true`、组件 `enabled=true`。

## 实例覆盖与 Apply

1. CLI 精确计划并提交场景实例组件 `enabled=true→false`：operation `e75f0233-6c68-4f55-8ce0-08c021ccb826`，plan hash `297fb9489ec2193fb81f8b17e9fc585a311dd79d7e9ae4e595e5f2bcab880a09`。`.fire` 读回哈希变为 `c20383687b37f7b2bdf5172d7539825954aa17d06370d22139744f2b4564a0d3`；`.meta` 不变。Prefab 实例 state hash 从 `3a2384324e6c78844dd02bba4828b18dfb30f278e33f6cbd6f581d16e91cdb62` 变为 `841fce29b5b659b0ff4467b011902e0ecfaf69cc00f5c480196d69f632049cde`，Prefab 源哈希仍是原值。
2. CLI `creator.prefab.instance.override` 的 `apply` 计划/提交：operation `66345858-74e4-4b8c-9d98-1b4053bcf064`，plan hash `d91fbe2b52d53772d077e3696fdaa087d346f2e37b4703ede8b2eaa8cde3654c`。Creator 回报 `effect-observed`，Prefab 源 SHA-256 变为 `cf737adde6c66fc3e9b0555501718dca7d70b40a31acffcd67e0018b66cdfd08`；场景文件哈希不变，两个 `.meta` 不变。
3. Apply 会保存该实例的全部当前覆盖，而非只应用触发操作的 `enabled` 字段。只读检查保存的 `.prefab` 发现 Creator 同时把原本已存在的实例覆盖 `active=true` 写入源：源节点 `_active=true`、`cc.BlockInputEvents._enabled=false`。原生 Apply 回执的 `semanticOverrideValuesVerified=false`，所以不能只凭哈希宣称字段语义通过；以上字段由只读序列化检查分别核对。

## 源恢复与实例 Revert

为防止 Apply 将原有 `active=true` 差异留在源 Prefab，使用两次精确 `creator.prefab.source.patch` 操作恢复基线：

- 源组件 `enabled=false→true`：operation `c51a6640-dd6e-4ddb-84a3-00b2371cfb93`，plan hash `b8d965d0cb12073a6788e04c259444bdca4931286b8948f8e355a4162771d4d5`，提交回执确认 Creator Prefab 编辑模式保存、退出、重开及文件读回；
- 源节点 `active=true→false`：operation `bf4c07d3-0080-4bf6-acde-d25473e8fac8`，plan hash `ddf470c113c8ef7311b1abf8cdd8cf1d3e94ea2861a0e30d0062ae64031d7c63`。Prefab 源 SHA-256 精确回到 `189d2ed73c6e021ee48a52fda6bab30c60345cc35bfdbfc3458d062ccb5e9200`，源 `.meta` 哈希未变。

随后 CLI 为同一实例创建并提交 `revert`：operation `7d8fff45-a1c5-41dd-a961-11bf4a7a4f25`，plan hash `7667b51054dec9903340f5ec2da33ea72882dd7a29d975a7806656b14edb1d66`。Creator 回报 `effect-observed`，场景 `.fire` SHA-256 精确回到 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，源 Prefab 与其 `.meta` 仍保持原哈希；实例 state hash 回到 `3a2384324e6c78844dd02bba4828b18dfb30f278e33f6cbd6f581d16e91cdb62`。

## 整工程关闭/重开读回

使用 CLI 关闭 PID 73301 并重开同一工程。新实例 `6c4aa5ea-0070-4b20-a65e-5deca0525be5` 返回准确工程路径、Creator 2.4.15、扩展 0.8.106；`doctor` 8/8 通过。重开后的场景快照为 23 个节点；目标实例仍为 `active=true`、`cc.BlockInputEvents.enabled=true`。`creator.prefab.source.inspect` 读回链接 Prefab UUID、1 个源节点、源根 `active=false` 和原始源哈希；现场 SHA-256 对 `.fire`、Prefab 与两个 `.meta` 均逐一匹配本节基线。

该实机结果证明 Creator 2.4.15 下一个组件公开字段的实例覆盖、原生 Apply、Creator-aware 源字段恢复、原生 Revert、整工程关闭/重开和基线哈希恢复。Apply 会一并保存实例上其他未应用覆盖；应在调用前检查精确实例状态。工具回执不自动解码所有组件覆盖，故字段语义需通过 Inspector/序列化读回确认。本例使用只读源文件检查协助解释 Creator 的 Apply 结果，没有直接改写 Prefab。
