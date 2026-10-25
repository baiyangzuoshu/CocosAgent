# Prefab ToggleGroup 字段往返验收（Creator 2.4.15）

本记录验证 Cocos CLI 能否在现有 Prefab 中追加一个 UI 组件、修改该组件公开字段、分别按来源操作补偿，并在整工程关闭/重开后恢复精确资源基线。所有 Creator 操作均经 `tools/cocos-creator-agent-cli/cli.mjs` 和 Creator Prefab 编辑模式完成，没有使用桌面自动化，也没有直接写入 Prefab 序列化文件。

## 工程与资源身份

- 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`
- Creator：2.4.15；CLI：0.12.62；Creator 扩展：0.8.108
- 验收场景：`CliAcceptanceScene`，UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`
- Prefab：`db://assets/CliBlockInputEventsTest.prefab`，AssetDB UUID `21119a83-ebeb-4542-bd8b-b477c2b1f2f5`
- 根节点：`CliBlockInputEventsPrefabInstance`，稳定节点 ID `prefab_root_21119a83-ebeb-4542-bd8b-b477c2b1f2f5`
- 基线 Prefab SHA-256：`189d2ed73c6e021ee48a52fda6bab30c60345cc35bfdbfc3458d062ccb5e9200`
- 基线 `.meta` SHA-256：`ab6b5fa05f91d463f8a612129bc734a188aedd18e4f33ff4afd52f8157643821`

## 编辑、字段与来源补偿

1. 用 `creator.prefab.source.patch.plan/commit` 在根节点追加 `cc.ToggleGroup`。来源 operation `c36e973a-8b8b-4d09-82e9-75962f37bb21` 完成后，Creator 保存回调确认，Prefab 模式退出/重开及磁盘读回成功。Prefab SHA-256 从基线变为 `ee3279903e83626fd67e13797164f1a148460cacbc1e3e265508ac3b9b3a5665`，`.meta` 不变。新增组件稳定身份为 `prefab_component_c792da5213effe8fde90ca0a`，索引 1。
2. 计划并提交 `cc.ToggleGroup.allowSwitchOff` 从 `false` 到 `true`。operation `c3d0eedb-e9fa-4c23-9b93-1055b9fa3829` 完成，保存、Prefab 模式退出/重开和磁盘读回成功；Prefab SHA-256 为 `131d1db29a10879a166baabf1bc09dceb886e86ef1435a68df8c8a7688510fd9`，`.meta` 不变。
3. 对字段 operation 执行来源补偿 `9b158731-92e0-4512-b826-76f2c619d5a5`，将 `allowSwitchOff` 恢复为 `false`。Creator 保存、退出/重开与磁盘读回成功，Prefab SHA-256 精确回到添加 ToggleGroup 后的 `ee3279903e83626fd67e13797164f1a148460cacbc1e3e265508ac3b9b3a5665`，`.meta` 不变。
4. 对组件追加 operation 执行来源补偿 `5cfe441a-53cf-48a8-a7a5-8256cf9f3cef`，移除该来源操作追加的 ToggleGroup。Creator 保存、退出/重开与磁盘读回成功，Prefab SHA-256 精确恢复基线 `189d2ed73c6e021ee48a52fda6bab30c60345cc35bfdbfc3458d062ccb5e9200`，`.meta` 保持 `ab6b5fa05f91d463f8a612129bc734a188aedd18e4f33ff4afd52f8157643821`。

## 整工程关闭/重开核验

- 重启前 `creator.project.info` 确认路径、工程名、Creator 版本和活动场景均正确；CLI `project close` 退出了进程，`project open --creator /Applications/Cocos/Creator/2.4.15/CocosCreator.app` 返回 `editorReady: true`。
- 重开实例 `bb0e1acc-6d5f-432f-9f28-4ba6eed97a74` 的 `creator.project.info` 再次确认工程路径 `/Users/youjunmao/WORK/Cocos_Engine/tank`、Creator 2.4.15、扩展 0.8.108 及活动场景 UUID。
- `creator.prefab.source.inspect` 读回相同 Prefab UUID；根节点只有原有 `cc.BlockInputEvents`，没有 ToggleGroup；Prefab 与 `.meta` 哈希分别精确匹配基线。
- 重开后 `doctor` 8/8 检查通过、0 warning、0 error；CLI 报告 99 个 Creator 命令均可用。

## 结论边界

本项实机证明：Creator 2.4.15 下，可通过 CLI 在现有 Prefab 追加 `cc.ToggleGroup`、修改其声明的 Boolean 字段，并分别从源操作补偿字段与组件；随后通过整工程关闭/重开和磁盘哈希确认资源恢复。它验证的是一个内置组件和一个 Boolean 属性的往返，不代表任意组件字段、对象/资源引用、其他组件删除方式或运行时 ToggleGroup 可视效果均已覆盖。已有 ToggleGroup 运行时组行为的独立证据见 [ToggleGroup CLI 实机验收](cocos-creator-cli-toggle-group-acceptance-20261024.md)。
