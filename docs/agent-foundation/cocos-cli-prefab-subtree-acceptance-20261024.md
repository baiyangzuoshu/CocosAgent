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

## 0.8.95 项目脚本组件实机验收

同日追加：CLI `0.12.59`、Creator `2.4.15`、项目扩展 `0.8.95`。全程通过 Cocos CLI 识别、打开、关闭和重开工程，并通过 CLI 命令计划、提交、检查 Prefab 与补偿；没有使用电脑 UI 自动化，也没有直接编辑 `.prefab` 文件。

测试目标是 `db://assets/CliBlockInputEventsTest.prefab` 根节点，AssetDB UUID 为 `21119a83-ebeb-4542-bd8b-b477c2b1f2f5`。追加前该节点只有 `cc.BlockInputEvents`。新增组件类 `CliAcceptanceButtonState` 的源码由 `creator.script.read` 核对：脚本仅声明 `clickCount`、`lastValue` 与点击回调，没有自定义构造器或生命周期钩子。Creator 序列化类 ID 为 `06c42enFbFEiYNCYZ2M0Azh`。

| 操作 | operation ID | Prefab 源 SHA-256 | `.meta` SHA-256 |
| --- | --- | --- | --- |
| 追加项目脚本组件 | `c9bbebe2-5e2e-41fb-8d67-1fb8d18e67bc` | `189d2ed73c6e021ee48a52fda6bab30c60345cc35bfdbfc3458d062ccb5e9200` → `499e4814a4a6aad97609e6e83cb53b1643317b80755d703c06d036f9a16a69ec` | `ab6b5fa05f91d463f8a612129bc734a188aedd18e4f33ff4afd52f8157643821`，不变 |
| 来源补偿移除该组件 | `80a071b4-ac6a-491c-b40c-d00f4de2ce65` | `499e4814a4a6aad97609e6e83cb53b1643317b80755d703c06d036f9a16a69ec` → `189d2ed73c6e021ee48a52fda6bab30c60345cc35bfdbfc3458d062ccb5e9200` | `ab6b5fa05f91d463f8a612129bc734a188aedd18e4f33ff4afd52f8157643821`，不变 |

追加提交回执确认 Creator 保存、Prefab 编辑态退出/重进和磁盘读回；随后由 Cocos CLI 整工程关闭并重开，`creator.prefab.source.inspect` 读回两个组件及追加脚本公开字段。补偿由原新增操作派生，提交后 Creator 读回原 `cc.BlockInputEvents`，Prefab 源哈希回到基线。最后再次整工程 CLI 关闭/重开并读回，节点组件数为 1，Prefab SHA-256 为 `189d2ed73c6e021ee48a52fda6bab30c60345cc35bfdbfc3458d062ccb5e9200`，`.meta` SHA-256 仍为 `ab6b5fa05f91d463f8a612129bc734a188aedd18e4f33ff4afd52f8157643821`。CLI `vcs status` 没有报告 Tank 场景或 Prefab 文件变更；工程变更仅为本地受管扩展升级到 0.8.95。

过程中发现并修复两处合同边界：只有组件结构差异时，计划阶段必须省略空属性选择器；来源补偿验证时，Prefab 磁盘快照不携带运行时注册类名，因此匹配按序列化类 ID 与组件实例身份进行，运行时注册类名只用于解析要创建/移除的脚本类。第一次补偿前置检查拒绝且 reconcile 确认状态仍为 `not-applied`、源文件哈希未变；修复后以新补偿计划完成，没有重放失败操作。

此项验收证明一个已注册项目脚本组件的追加、整工程重开读回和来源补偿。它不证明任意组件依赖、脚本生命周期副作用、已有组件直接删除、多脚本批量添加或 UI 可视行为已经覆盖。

## 0.8.105 继承型 disallowMultiple 前置检查

CLI `0.12.60`、Creator `2.4.15`、项目扩展 `0.8.105`。全程只用 Cocos CLI；没有电脑 UI 自动化，也没有直接修改 `.prefab` 文件。测试资产为 `db://assets/CliBlockInputEventsTest.prefab`，UUID `21119a83-ebeb-4542-bd8b-b477c2b1f2f5`，目标为 Prefab 根节点。

起始 `.prefab` SHA-256 为 `189d2ed73c6e021ee48a52fda6bab30c60345cc35bfdbfc3458d062ccb5e9200`，`.meta` SHA-256 为 `ab6b5fa05f91d463f8a612129bc734a188aedd18e4f33ff4afd52f8157643821`。先通过 CLI 将 `cc.Sprite` 追加为第二个组件：operation `8ca23fe1-583d-4b59-97f3-31a4cbc0f98f` 完成，保存并重新进入 Prefab 模式后，CLI 读回组件顺序及源 SHA-256 `86435ec1c69013cd63b46c849baa6e0b9c6eed155d1ff102cbd9c60d66eb9774`；`.meta` 不变。随后尝试将 `cc.Label` 追加为第三个组件。旧实现的 plan 放行，但 Creator 的 `RenderComponent.disallowMultiple` 使 commit 返回 `OPERATION_RECONCILIATION_REQUIRED`；按原 operation `a906bf18-f41f-410c-8991-039e6c58e67b` reconcile 得到 `not-applied`，源及 `.meta` 哈希均未变化。

Creator 2.4.15 源码确认 `cc.Sprite` 与 `cc.Label` 都继承带 `disallowMultiple` 的 `RenderComponent`。扩展修正继承链检查后升级到 `0.8.105`。同一 `cc.Label` 计划现在在写入前返回 `PREFAB_COMPONENT_DISALLOW_MULTIPLE_CONFLICT`，没有创建写入 operation，源文件仍保持 `86435ec1…e9774`。随后按原 Sprite operation 派生补偿 `073c2a63-c911-48ce-8d43-da453c9ebf73`，移除且只移除该次新增组件；Creator 保存及 Prefab 模式退出/重进均通过，源 SHA-256 回到 `189d2ed7…e9200`。

最后由 CLI 关闭并重开整个 tank 工程，Creator 2.4.15 / 扩展 `0.8.105` 握手就绪。重开后的 `creator.prefab.source.inspect` 仍读到原有单个 `cc.BlockInputEvents`，Prefab SHA-256 与 `.meta` SHA-256 均精确回到起始值；扩展状态为 `matchesBundle: true`、`changedFiles: []`。自动化回归 `npm test`：`366/366` 通过。

此回执证明 Prefab 组件追加时会沿 Creator 继承链提前拒绝不兼容组合，并证明原追加操作可补偿恢复。它没有证明同节点多个允许共存组件的组合，也没有实现任意已有组件删除；这两项仍待单独验收。

同一继承冲突检查已在 CLI/扩展 `0.12.60` / `0.8.106` 接入场景组合计划。Creator 2.4.15 Tank 的 CLI plan-only 请求在新节点上同时声明 `cc.Sprite` 和 `cc.Label`，返回 `SCENE_COMPOSE_COMPONENT_DISALLOW_MULTIPLE_CONFLICT`，没有生成可提交 operation，也没有改动场景。扩展重开后状态 `matchesBundle: true`，Creator `project.info`、Scene 快照和 Prefab 读回均绑定 tank 的当前实例；健康检查 9/9 通过。此项是计划阶段拒绝证据，不是一次场景写入验收。

## 0.8.108 既有 BlockInputEvents 删除与来源补偿

2026-10-25，CLI `0.12.62`、Creator `2.4.15`、项目扩展 `0.8.108`。所有项目操作均通过 Cocos CLI；没有电脑 UI 自动化，也没有直接编辑 `.prefab` 文件。工程为 `/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 项目名 `tank`，活动场景 `CliAcceptanceScene`（UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`）。

目标是已有 Prefab `db://assets/CliBlockInputEventsTest.prefab`（UUID `21119a83-ebeb-4542-bd8b-b477c2b1f2f5`）根节点上的 `cc.BlockInputEvents`，组件身份由 AssetDB UUID 与节点 UUID 推导，`enabled=true`，`_id` 为合成身份。起始 Prefab SHA-256 为 `189d2ed73c6e021ee48a52fda6bab30c60345cc35bfdbfc3458d062ccb5e9200`，`.meta` SHA-256 为 `ab6b5fa05f91d463f8a612129bc734a188aedd18e4f33ff4afd52f8157643821`。

| 操作 | operation ID | 计划哈希 | Prefab SHA-256 | `.meta` |
| --- | --- | --- | --- | --- |
| 删除既有组件 | `bd03e533-15ad-4baa-bd8d-4935e0c9bd2e` | `5d62aa9f66b6d36520b033d156ad1d267d30796e5d59fda7fd899f8c3e800177` | `189d2ed7…e9200` → `c4f5c3c0ac4653da8bea50860dd6480f645504a88830270abc717fa4ae8a3207` | 不变 |
| 来源补偿恢复 | `f6d2749b-be66-444c-a3d8-cdbc0ac9cee5` | `99baff8b21872bf7d8466aad23547dd12c1cfb985b3dc7ef95cca454d84cc951` | `c4f5c3c0ac4653da8bea50860dd6480f645504a88830270abc717fa4ae8a3207` → `189d2ed7…e9200` | 不变 |

两次提交回执均确认 Creator 保存、Prefab 编辑态退出/重进和精确磁盘读回。补偿保留原来的合成组件身份与 `enabled=true`，没有把临时运行时 ID 写进 Prefab。之后 CLI 关闭并重开整个 Tank 工程，Creator/扩展握手为 `2.4.15` / `0.8.108`；CLI 重读组件数为 1、`enabled=true`、同一合成身份。场景 Prefab 实例状态哈希仍为基线 `3a2384324e6c78844dd02bba4828b18dfb30f278e33f6cbd6f581d16e91cdb62`；场景 `.fire`/`.meta` SHA-256 为 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593` / `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`，均为原记录基线。Prefab 与 `.meta` 也精确恢复上述起始哈希。

本能力目前只开放给 Prefab 组件列表末尾、无其它组件依赖且可记录 `enabled` 状态的 `cc.BlockInputEvents`。其它已有组件直接删除、任意属性/资源/节点/组件引用的完整恢复仍未实现；此项不代表任意 Prefab 组件都可安全删除。
