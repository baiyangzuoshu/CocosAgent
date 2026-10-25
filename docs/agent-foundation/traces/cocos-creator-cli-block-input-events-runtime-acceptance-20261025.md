# BlockInputEvents CLI 运行时验收

日期：2026-10-25。Creator `2.4.15`、CLI `0.12.62`、项目扩展 `0.8.108`。工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`，场景 `CliAcceptanceScene`（UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`）。全程通过 Cocos CLI 与 CLI 附属 Preview 会话；没有使用电脑操控，也没有直接编辑 `.fire` 文件。

## 测试对象与基线

测试使用场景中已有的 Button（节点 UUID `96907646-d467-4b3b-8870-e0bc076a31fb`，`CliAcceptanceButtonState.clickCount=5`）和 `CliBlockInputEventsTest`（节点 UUID `ba228e24-03d8-4342-a983-dd7a3a70ceaf`，组件 ID `6ccW8CFAhKuKAZZVfmCvlO`）。测试开始时场景 SHA-256 为 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` SHA-256 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。

CLI Preview 会话：`911c56fe-42de-49ce-8dc6-a849320e27e9`；场景名和 UUID 与工程回执一致，画布客户区为 960×640。初次点击画布中心 `(0.5, 0.5)` 将 Button 计数从 5 增至 6，确认输入位置能触发目标 Button；重新加载场景后计数回到序列化值 5。

## 操作与结果

| 操作 | operation ID | CLI/运行时结果 |
| --- | --- | --- |
| 将拦截节点设为 `x=0,y=0,width=240,height=120` 覆盖 Button | `3f2486e2-9dbd-47d9-aab4-8ffaf166e8ee` | Creator 保存成功，精确 `.fire` 读回与计划一致；场景 SHA 变为 `f3d9d23e76dcec665d5ead8b5c2ec6c4164337cba04eb2aab34e11578ea9127a`，`.meta` 不变 |
| 保持 `enabled=true` 点击覆盖区域 | Preview assertion | `clickCount` 保持 5；`no-errors` 通过，新增错误 0 |
| 通过 CLI 设为 `enabled=false` | `eedfcb66-183e-4663-9158-73be4301aac2` | Creator 保存并从 `.fire` 读回 `_enabled=false`；场景 SHA 变为 `12b9416146ab6032f94fae2c18d7c15471e6bfa165d585537b83aa3acb4b4712` |
| 禁用后刷新 Preview 并点击覆盖区域 | Preview assertion | `clickCount` 从重新加载后的 5 增至 6；`no-errors` 通过，新增错误 0 |
| 从原属性操作生成并提交来源补偿，恢复 `enabled=true` | `97072f4a-621e-4297-aae3-afb0d9d1686f` | `.fire` 读回 `_enabled=true`，场景 SHA 回到变换保持覆盖时的 `f3d9d23e76dcec665d5ead8b5c2ec6c4164337cba04eb2aab34e11578ea9127a` |
| 恢复 enabled 后再次刷新 Preview 并点击覆盖区域 | Preview assertion | `clickCount` 保持 5；`no-errors` 通过，新增错误 0 |
| 恢复测试节点原变换 `x=350,y=-300,width=100,height=100` | `cc06d43d-e60f-4371-be79-3f10d4648321` | Creator 保存、精确 `.fire` 读回；场景 SHA 精确回到 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` SHA 不变 |

每次预览交互均通过相同会话中的 CLI `creator.preview.interact` 发送中心点击并读取 `CliAcceptanceButtonState.clickCount` 和 `no-errors` 断言。初始截图 SHA-256 `fe18ebcf549e78dfcd0305fd18492d5f845e798b00058ce4035298f303ca7e44`；遮挡组件本身不渲染图形，因此行为判断依赖 Button 业务计数，而不以截图判断拦截结果。

## 重启核验与范围

CLI `project close` 关闭原 Creator 进程 `88030`，`project open` 使用 `/Applications/Cocos/Creator/2.4.15/CocosCreator.app` 重开工程；新实例 ID 为 `12ba0da9-6c11-4bf8-b567-220535474de3`。CLI `project.info` 确认工程路径、版本与活动场景。重开后 `creator.scene.node.read` 读回原位置和尺寸，`creator.scene.ui.inspect` 读回相同组件 ID 且 `enabled=true`。磁盘 `.fire`/`.meta` SHA-256 分别精确为上述基线值。

重开后 Creator diagnostics 有两条来自项目脚本元数据的历史 warning（项目脚本重复声明类名、默认 String 属性标注冗余），没有 compile error 或 runtime error。此验收证明该场景夹具中矩形覆盖区域的 Web Preview 输入阻断、启停差异、CLI 保存/读回、来源补偿和重启恢复；没有覆盖任意父子嵌套、非矩形图形命中规则或原生设备输入。
