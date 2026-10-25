# Cocos Creator CLI SubContextView 字段验收（2.4.15）

日期：2026-10-25  
工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`  
Creator：2.4.15  
CLI：0.12.62  
扩展：0.8.111

本轮场景编辑、Inspector 读回、属性写入、补偿、移除、关闭和重开均经 Cocos CLI/MCP 完成，没有使用电脑 UI 自动化，也没有直接编辑 `.fire`。场景为 `CliAcceptanceScene`，UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`；目标 Canvas UUID `a4BTV8Z6tCnJw/YVbbE8Wk`。场景基线 SHA-256 为 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。

## Inspector 与 fps 往返

在 Canvas 上添加 `cc.SubContextView` 的 CLI 计划为 `cf3c283b-f34c-4cc2-a025-a3f9abaf4575`，计划哈希 `d682fc3fcbff532ff0e2ce85155076e160726d2d8af77cd11c629d159f9aa72d`。提交创建组件实例 `1a65SK4mpMJphscMEL7s2T` 并确认磁盘序列化组件身份和 Canvas 变换。

CLI `creator.scene.ui.inspect` 读回 `fps=60`，字段类型 Number，可编辑并序列化为 `_fps`；`enabled` 是通用组件开关。其余上下文/内部状态没有作为可写 Inspector 字段开放。

属性计划 `e561fb4d-6625-4885-ba95-b62da5bb1a0d`（哈希 `5c433643c5abd48c1501da43a5f97148a5a14d7471c9c775ae76ee74624caabe`）将 `fps` 从 60 写为 30。Creator 提交回执通过精确组件身份和场景 `.fire` 读回确认 `_fps=30`，`.meta` 未改变。随后来源补偿计划 `a98c5cae-c389-476e-bd40-f5145c3119d7`（哈希 `9ad5a59fdbe3571c76b1605070c2bad03c9da1877510b949209737be8f8ab3a7`）派生自该写入操作，将值恢复 60；提交回执确认磁盘读回 `_fps=60`。

## 清理与重开

精确移除组件的计划 `174d360c-72ea-4498-9907-eb7a63709415`（哈希 `888bf1c05543436102ecb7fb256f772090517c7897e3f9f13889a9d167c45396`）提交后，Creator 磁盘读回确认组件实例不存在，场景 SHA-256 恢复至基线 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` 仍为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。

CLI 关闭进程 PID `89800` 并确认退出，再从同一路径重开 Tank；PID `90113`、实例 `649ceea8-6c97-4981-bbd2-a4f3c7266f49` 返回 `editorReady=true`，报告 Creator 2.4.15 和扩展 0.8.111。重开后的场景快照确认原场景 UUID、23 个节点以及 Canvas 原有 `cc.Canvas`、`cc.Widget` 组件；文件 SHA-256 仍精确匹配基线。

本轮证明 `fps` 字段的 CLI Inspector 读取、数字写入、来源补偿和关闭/重开恢复。没有微信小游戏运行目标或子域配置的验收证据，因此子域创建、刷新率效果和平台行为仍待验证。
