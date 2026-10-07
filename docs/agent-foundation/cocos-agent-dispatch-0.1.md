# CocosAgent 调度切片 0.1

入口为 `tools/cocos-agent-bridge/agent-dispatch.js`。执行命令时，调用方必须显式给出候选 Creator 项目、目标项目绝对路径、版本、命令和 JSON 输入。调度器依次运行 `instances.list → capabilities.list → bridge-host`；对 `scene.pngSprite` 再运行 `operation.get`，由持久回执判断下一步。按操作 ID 查询或录入预览观察时只需项目和版本，不连接编辑器。它不会按最近使用窗口猜测目标，也不会因执行失败自动重试写入。

选择阶段要求项目路径唯一、版本匹配、实例 `ready`、命令合同为 `0.1` 且 `available`。第二次目录查询的实例 ID、场景名和目录修订号必须与第一次一致。执行 Host 握手时再次核对实例 ID，读取场景快照后再次核对场景名；变化则在写入前停止。目录可用性只是查询时的状态，资源文件、SpriteFrame 和场景结构仍由执行 Host 重新校验。

输出为单行 JSON，字段固定为 `success`、`outcome`、`command`、`instance`、`operationId`、`result`、`phases`、`intent`、`error`；不适用的字段为 `null`。四类命令成功时都含结构化 `result`；失败时 `error` 统一含 `code`、`message`、`phase`、`retryable` 和 `sideEffect`。`outcome` 含义：

| 值 | 调度动作 |
| --- | --- |
| `completed` | 只读查询或导入命令成功；场景放置/重放同时通过磁盘与预览回执；或补偿通过磁盘回执。 |
| `needs-preview` | 场景放置或重放已通过磁盘回执，仍需人工预览验收。 |
| `needs-review` | 写入请求可能已发出，但没有可确认的磁盘结果；保留操作 ID，先检查现场，不自动重发。 |
| `failed` | 目标、目录、输入或执行前条件失败；返回错误代码。 |

当前 `scene.snapshot` 仅接受 `{}`；目录虽然声明了可选 `targetNodeName`，调度入口尚未暴露该筛选。`scene.node.inspect` 输入为 `{"nodePath":"场景名/节点名"}`；`asset.importPng` 输入为 `{"sourcePath":"/绝对路径/图片.png"}`；`scene.pngSprite` 输入为 `{"assetName":"已导入图片.png","action":"apply|compensate|replay"}`，可选 `operationId`。一次调度只执行一个命令，PNG 导入与场景放置需分两次调用。

验收：`agent-dispatch.test.js` 用模拟 Host 验证目标变化、命令不可用、预览待验、结果不确定和补偿完成。两版 Creator 的真实 `scene.snapshot` 已跑通目录查询、目标选择、二次场景校验及结构化结果。3.8 实机还故意传错实例 ID 和场景名，执行 Host 均在场景写入前退出。两版 Creator 均通过调度入口执行一次测试 PNG 放置与补偿：放置返回 `needs-preview`，补偿返回 `completed`，四次操作的磁盘阶段均为 `passed`。场景文件在测试后按已核对的 HEAD 基线逐字节恢复。调度入口尚不控制预览；`needs-preview` 不能解释为画面已验收。

首轮画面检查由 Agent 在两版真实 Web 预览中完成：3.8 白色测试图出现在 3D 场景中央，2.4 白色测试图覆盖 Hello World 徽标中心；补偿并刷新后均消失。首轮检查只写入[独立轨迹](traces/cocos-agent-dispatch-0.1.jsonl)，对应历史操作记录仍为 `preview=pending`，没有追溯改写。

现在可通过 `--preview-accept <operationId> --evidence '{"url":"http://127.0.0.1:7457/","observedAt":"<ISO 时间>","note":"<实际观察>"}'` 录入本次人工视觉观察，或通过 `--operation-get <operationId>` 在不连接编辑器的情况下重新判断状态。录入只适用于已通过磁盘读回的 `apply/replay`；它要求本地 HTTP 预览地址和不早于操作创建时间的观察时间。重复录入不会新增回执。四类命令及操作状态读取统一输出 [`dispatch-result.schema.json`](../../tools/cocos-agent-bridge/dispatch-result.schema.json) 的结果包。`preview=passed` 表示有经调用方报告的视觉证据，不代表 Host 自动分析了画面。

两版新操作均复测了 `needs-preview → visual-preview 回执 → completed`，每条操作恰有一条通过的预览回执。补偿后分别刷新 Web 预览确认测试图消失，最后恢复原场景哈希。操作 ID 和条件见[轨迹](traces/cocos-agent-preview-receipt-0.1.jsonl)。
