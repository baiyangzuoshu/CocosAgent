# Creator 2.4.15 Prefab 子树实机验收

日期：2026-10-24
工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`
Creator：2.4.15
项目扩展：0.8.72
CLI：0.12.55

## 结果

全程通过 Cocos CLI 对 Prefab 做计划、提交、补偿、关闭工程和重开；没有使用电脑 UI 自动化。每项写入后都关闭 Creator 工程，再由 `cocos-creator-agent project open` 等待项目路径、版本和扩展握手就绪。Prefab patch 回执另确认 Creator 保存、退出 Prefab 模式、重新进入和磁盘读回。

在临时 Prefab 中，CLI 创建了 `CliActionPanel/CliActionButton` 两层子树；在子节点添加 `cc.Button`，将 `zoomScale` 从 `1.2` 改为 `1.5`，并把 `clickEvents` 绑定到 Prefab 根节点的 `CliAcceptanceButtonState.onClick`。Creator 2.4.15 保存并关闭/重开后，CLI 读回确认节点 UUID、层级、组件、属性和事件均与计划一致。

| 操作 | apply operation | source-linked compensation | 哈希往返 |
| --- | --- | --- | --- |
| 两节点 `node.subtree` | `269c9c73-994e-4302-bc9f-518859119f3b` | `ca37aa77-3bd0-4cde-96d8-24f9ef7d1986` | `48d0083a…f89416` → `24f5647f…501b8` → `48d0083a…f89416` |
| 新增 `cc.Button` | `5231e42d-38e4-4d6f-9d42-910b1c28b288` | `b5cc9cc0-d2e2-44e9-b301-15ecc458651b` | `24f5647f…501b8` → `869e5d2d…a81545` → `24f5647f…501b8` |
| `Button.zoomScale` | `5ade53ee-fc23-4317-9dac-3653bee5cd5b` | `2f4b7d97-6e37-4f51-aa2b-11fb85647457` | `869e5d2d…a81545` → `dc0ba80e…8516f6` → `869e5d2d…a81545` |
| `Button.clickEvents` | `6fba311d-c3c7-446f-bb1c-93be51217dcf` | `b0cd5bcb-545b-42b0-9c70-0f25354f368d` | `dc0ba80e…8516f6` → `2fba5516…360de04` → `dc0ba80e…8516f6` |

补偿按事件、属性、组件、子树逆序执行。Prefab `.meta` 哈希始终为 `17b2aeb4…22a39d9`。之后通过 AssetDB 清理临时 Prefab：完整文本引用扫描覆盖 8 个文件，扫描完整且 0 条引用；Prefab 与 `.meta` 均不存在。测试场景节点通过 CLI 删除，关闭/重开后 `CliAcceptanceScene.fire` 与 `.meta` 哈希分别恢复为 `cd1bd3f3…17f74` 和 `269c764b…7cba`。

## 修复与回归

第一次规划新增 Button 属性时失败并返回 `PREFAB_EXPECTED_STATE_MISMATCH`。原因是 Prefab 编辑态的节点未必能由场景树定位；Prefab 属性读取及写入现在可将已经精确定位的 live node 直接传给共享属性检查器，同时仍校验节点 UUID、组件类型/实例和字段前值。CLI 单元测试增加了 detached Prefab 节点属性读写用例。更新工程内受管理扩展后，真实 Creator 2.4.15 属性计划、提交、重开和来源补偿均通过。

`npm test`：348/348 通过。更新后的工程扩展状态通过 CLI 检查为 `matchesBundle: true`，没有文件差异。

## 边界与后续

此回执只证明当前覆盖的 componentless 子树、单个注册内置组件追加、Button 标量属性和 Button 点击事件。自定义脚本组件创建、既有组件直接删除、组件依赖与属性类型全面矩阵、SpriteFrame/数组资源引用往返、最终 UI Prefab 运行效果仍需分别覆盖；此结果不能代替完整 UI 验收矩阵。
