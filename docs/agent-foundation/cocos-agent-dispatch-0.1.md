# CocosAgent 调度切片 0.1

入口为 `tools/cocos-agent-bridge/agent-dispatch.js`。调用方必须显式给出候选 Creator 项目、目标项目绝对路径、版本、命令和 JSON 输入。调度器依次运行 `instances.list → capabilities.list → bridge-host`；对 `scene.pngSprite` 再运行 `operation.get`，由持久回执判断下一步。它不会按最近使用窗口猜测目标，也不会因执行失败自动重试写入。

选择阶段要求项目路径唯一、版本匹配、实例 `ready`、命令合同为 `0.1` 且 `available`。第二次目录查询的实例 ID、场景名和目录修订号必须与第一次一致。执行 Host 握手时再次核对实例 ID，读取场景快照后再次核对场景名；变化则在写入前停止。目录可用性只是查询时的状态，资源文件、SpriteFrame 和场景结构仍由执行 Host 重新校验。

输出为单行 JSON：`success`、`outcome`、`instance`、`command`，场景操作另含 `operationId`、`phases` 和 `intent`。`scene.snapshot` 与 `asset.importPng` 成功时含结构化 `result`。`outcome` 含义：

| 值 | 调度动作 |
| --- | --- |
| `completed` | 只读查询或导入命令成功；场景补偿已通过磁盘回执。 |
| `needs-preview` | 场景放置或重放已通过磁盘回执，仍需人工预览验收。 |
| `needs-review` | 写入请求可能已发出，但没有可确认的磁盘结果；保留操作 ID，先检查现场，不自动重发。 |
| `failed` | 目标、目录、输入或执行前条件失败；返回错误代码。 |

当前 `scene.snapshot` 仅接受 `{}`；目录虽然声明了可选 `targetNodeName`，调度入口尚未暴露该筛选。`asset.importPng` 输入为 `{"sourcePath":"/绝对路径/图片.png"}`；`scene.pngSprite` 输入为 `{"assetName":"已导入图片.png","action":"apply|compensate|replay"}`，可选 `operationId`。一次调度只执行一个命令，PNG 导入与场景放置需分两次调用。

验收：`agent-dispatch.test.js` 用模拟 Host 验证目标变化、命令不可用、预览待验、结果不确定和补偿完成。两版 Creator 的真实 `scene.snapshot` 已跑通目录查询、目标选择、二次场景校验及结构化结果。3.8 实机还故意传错实例 ID 和场景名，执行 Host 均在场景写入前退出。两版 Creator 均通过调度入口执行一次测试 PNG 放置与补偿：放置返回 `needs-preview`，补偿返回 `completed`，四次操作的磁盘阶段均为 `passed`。场景文件在测试后按已核对的 HEAD 基线逐字节恢复。调度入口尚不控制预览；`needs-preview` 不能解释为画面已验收。

随后由 Agent 在两版真实 Web 预览中独立完成画面检查：3.8 放置后白色测试图出现在 3D 场景中央，补偿并刷新后消失；2.4 放置后白色测试图覆盖 Hello World 徽标中心，补偿并刷新后徽标恢复。两版场景文件再次恢复到测试前 SHA-256。视觉检查已在[轨迹](traces/cocos-agent-dispatch-0.1.jsonl)单独记为通过；当前 Host 没有录入该观察的接口，历史操作记录里的 `preview` 仍为 `pending`，不得把记录字段改写成已自动验收。
