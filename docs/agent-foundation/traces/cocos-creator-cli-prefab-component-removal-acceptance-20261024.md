# Prefab 既有内置组件删除与来源补偿验收

## 环境与目标

- Creator：2.4.15，`/Applications/Cocos/Creator/2.4.15/CocosCreator.app`
- CLI：0.12.62；Creator 扩展：0.8.108
- 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`
- Prefab：`CliBlockInputEventsTest.prefab`，AssetDB UUID `21119a83-ebeb-4542-bd8b-b477c2b1f2f5`
- 目标节点：`CliBlockInputEventsPrefabInstance`，稳定节点 ID `prefab_root_21119a83-ebeb-4542-bd8b-b477c2b1f2f5`

本次扩展已有组件删除的可恢复范围。测试在 Prefab 根节点临时加入末尾 `cc.ToggleGroup`，用 Inspector 确认 `enabled=true`、`allowSwitchOff=false`，再经 CLI 计划删除、提交和按原操作来源补偿。所有 Prefab 修改均由 Creator Prefab 编辑模式执行，没有直接改写 `.prefab`。

## 操作与结果

1. 删除操作 `c80d2967-e1e8-41fe-8f64-9d819f87fb43` 将组件从 `[cc.BlockInputEvents, cc.ToggleGroup]` 改为 `[cc.BlockInputEvents]`。计划捕获了 ToggleGroup 的启用状态、合成身份和 `allowSwitchOff=false`。Creator 保存、退出、重开及磁盘读回通过，源 SHA-256 从 `ee3279903e83626fd67e13797164f1a148460cacbc1e3e265508ac3b9b3a5665` 变为 `189d2ed73c6e021ee48a52fda6bab30c60345cc35bfdbfc3458d062ccb5e9200`。
2. 第一次补偿遇到不确定编辑器状态。CLI 关闭并重开工程后，原操作被调和为 `not-applied`，磁盘仍是删除后哈希，未发生自动重放。
3. 新补偿操作 `c7f25ee8-9797-48aa-b09f-9928aee6659e` 首次暴露 Creator setter 的无变化行为：新建 ToggleGroup 的默认值已经是 `false`，恢复流程仍调用 setter，返回 `SCENE_COMPONENT_PROPERTY_NO_CHANGE`。修复后，恢复逻辑先比较 Creator Inspector 当前值与捕获值；值已相同时跳过 setter，值不同时才调用 setter。
4. 修复后的来源补偿 `c7f25ee8-9797-48aa-b09f-9928aee6659e` 完成。Creator 保存、退出 Prefab、重新打开并读取 Inspector；`enabled=true`、`allowSwitchOff=false` 和组件身份均匹配。磁盘读回 SHA-256 为 `ee3279903e83626fd67e13797164f1a148460cacbc1e3e265508ac3b9b3a5665`，与删除前相同；`.meta` SHA-256 始终为 `ab6b5fa05f91d463f8a612129bc734a188aedd18e4f33ff4afd52f8157643821`。
5. 清理操作 `ff2c79fc-0a4a-4e45-8f3e-fa202e94c55d` 再次按 CLI 计划删除临时 ToggleGroup。Creator 保存、退出、重开和磁盘读回通过，Prefab 回到最初仅有 `cc.BlockInputEvents` 的 SHA-256 `189d2ed73c6e021ee48a52fda6bab30c60345cc35bfdbfc3458d062ccb5e9200`，`.meta` 仍为原哈希。

## 自动化回归与限制

`test/prefab-source-patch.test.mjs` 覆盖 ToggleGroup 删除后恢复非默认值 `true`，以及 Creator 默认值已等于捕获值 `false` 时不调用无变化 setter、仍完成补偿。定向测试 30/30 通过。

目前实机删除证据覆盖末尾 `cc.BlockInputEvents` 的 `enabled` 和 `cc.ToggleGroup` 的 `allowSwitchOff`。删除仍要求组件是最后一个组件、无依赖、没有未捕获的事件列表，并且每个公开可序列化 Inspector 字段都属于支持的值类型。资源/节点/组件引用、数组和其他不支持值类型继续拒绝；本记录不代表任意组件或任意 Prefab 编辑已完成。
