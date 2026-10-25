# Creator 2.4.15 ToggleGroup CLI 实机验收

日期：2026-10-24  
工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`  
Creator：2.4.15  
Cocos Creator CLI：0.12.59  
项目扩展：0.8.100

## 验收范围

全程通过 Cocos CLI 的 Creator 命令及其 CLI-owned Web Preview 操作；未使用电脑 UI 自动化，也未直接编辑 `.fire` 文件。测试仅覆盖 `cc.ToggleGroup` 的 `allowSwitchOff` 行为、两个 Toggle 的运行时组关系，以及 getter-only `toggleItems` 的拒写。

基线活动场景为 `CliAcceptanceScene`，场景 UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`。测试前 `.fire` SHA-256 为 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` SHA-256 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。

## 操作与运行时结果

| 操作 | operation ID | 结果 |
| --- | --- | --- |
| CLI 组合临时 ToggleGroup 与两个 Toggle | `ed507614-f112-4505-a828-939f36deaf15` | 三个节点及三个组件由 Creator 创建并保存；A 的初始值为 true，B 为 false |
| A 的 `toggleGroup` 组件引用 | `bd9aad07-94db-47b1-bc76-b5b5a322e22b` | 写入精确的 `cc.ToggleGroup` 组件引用，磁盘读回通过 |
| B 的 `toggleGroup` 组件引用 | `1cab4edc-8e1c-4058-b055-721a79c8179a` | 写入同一组组件引用，磁盘读回通过 |
| `allowSwitchOff=false` → `true` | `124bb95e-7063-4c4c-b824-af4a68672de0` | CLI 属性计划、提交和磁盘读回通过 |
| 来源补偿 `allowSwitchOff=true` → `false` | `3bb2d7aa-7f7e-47ea-95b6-81983f8e4b31` | 从原操作派生恢复值，CLI 提交和磁盘读回通过 |
| 删除临时测试子树 | `1369496b-d04a-4f49-bb12-a021970caa0a` | CLI 确认三个测试节点 UUID 均不存在，场景哈希回到基线 |

CLI-owned Preview session `a3d76472-dc1d-4fff-8075-d2ed4d942af7` 绑定同一工程和活动场景，启动时 `consoleErrorCount=0`。使用归一化 Canvas 坐标点击两个 Toggle，并用 Preview 组件断言检查实际 `isChecked`：

- `allowSwitchOff=false`：点击 B 后 A=false、B=true；再次点击已选中的 B 后仍为 A=false、B=true；点击 A 后切回 A=true、B=false。
- `allowSwitchOff=true`：点击已选中的 A 后 A=false、B=false。
- 来源补偿恢复 `allowSwitchOff=false` 并刷新 Preview 后，先断言运行时初始为 A=true、B=false，再点击 A 并断言仍为 A=true、B=false。
- 各次最终状态断言均通过，Preview 未报告新增 Console 错误。早期探索曾在仍为 `allowSwitchOff=true` 的预览状态下使用了不匹配的预期值；本记录以重新创建的独立夹具、显式初始态断言和最终通过的边界断言为准。

`toggleItems` 是 Creator 返回的 getter-only 数组。通过 Cocos CLI 提交对其赋空数组的计划时，Creator 合同拒绝并返回 `SCENE_COMPONENT_PROPERTY_NOT_SERIALIZABLE`；没有产生写入。

## 关闭、重开与基线恢复

临时子树删除后，CLI 关闭 Creator，确认进程退出且桥接断开；再用 CLI 重开同一绝对路径。新实例 `d130b4ad-655e-436a-95c1-db61ef962c4f` 返回 `editorReady=true`，项目路径正确、Creator 2.4.15、扩展 0.8.100，活动场景 UUID 不变。关闭/重开后的 CLI 场景快照为 23 个节点，不含临时 ToggleGroup 节点；`.fire` 与 `.meta` 哈希均与测试前一致。CLI 扩展状态检查返回 `matchesBundle=true`、`bundleDifferences=[]`。

本验收证明 ToggleGroup 的组引用可由现有 CLI 字段写入能力设置、`allowSwitchOff` 两种行为在 Web Preview 中生效，并且只读 `toggleItems` 写入被拒绝。它不证明 Toggle/Sprite/checkMark 的视觉皮肤效果，也不覆盖 ToggleGroup Prefab 源编辑或目标平台差异。
