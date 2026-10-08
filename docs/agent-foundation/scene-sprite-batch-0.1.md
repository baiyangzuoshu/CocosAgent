# Creator 2.4 场景 Sprite 批次 0.1

接口 schema：[`scene-sprite-batch.schema.json`](../../tools/cocos-agent-bridge/scene-sprite-batch.schema.json)。此功能是 Host 对既有 `scene.pngSprite` 的顺序编排，只支持 Creator **2.4.15**；它没有新增编辑器侧命令，也不修改 3.8 扩展。

## 输入与阶段

`scene.sprites.plan` 和 `scene.sprites.execute` 接收 `targets`、精确的 `projectRoot`、`creatorVersion="2.4.15"`，以及 2–16 个已导入 PNG 文件名。每项必须位于项目 `assets/resources/`，并有 Creator 生成的 `.meta`。可选 `positions` 是与 `assets` 等长的 `{x,y}` 数组，按索引配对；坐标是 Canvas 本地设计像素，原点在 Canvas 中心，范围限制为 ±4096。省略时各 Sprite 保持现有单图命令的 `(0,0)` 默认位置。位置定义依据[2.4 节点变换手册](https://docs.cocos.com/creator/2.4/manual/zh/content-workflow/transform.html)与[Canvas 手册](https://docs.cocos.com/creator/2.4/manual/zh/components/canvas.html)。位置只描述节点锚点，不保证资源尺寸或构图一定落在视口内；仍需观察本次预览。

Agent 应先调用 `plan`；它只读验证唯一匹配的目标、活动场景、活动场景下 Canvas、PNG/SpriteFrame 的 UUID 关系、重复文件名、预留节点名冲突和位置数组。示例：`{"assets":["left.png","right.png"],"positions":[{"x":-64,"y":0},{"x":64,"y":0}]}`。

`execute` 为每个输入项持久分配独立 `operationId`，按顺序调用现有 `scene.pngSprite`，每项检查当前场景、资源摘要、节点名和 SpriteFrame UUID，要求编辑器回执与场景磁盘读回匹配。批次记录在项目 `.cocos-agent/scene-batches/<batchId>.json`；单项记录沿用 `.cocos-agent/operations/<operationId>.json`。相同 `batchId` 重复执行返回已有结果，不产生新节点。

| 批次状态 | 含义与 Agent 后续动作 |
| --- | --- |
| `ready` | `plan` 预检通过；没有写入。 |
| `needs-preview` | 所有节点已保存并逐项读回；尚未证明预览正确。按每项 `operationId` 实际检查 2.4 Web 预览，再分别调用 `preview.accept`。 |
| `completed` | 每项原操作均有通过的磁盘读回与本次预览回执。 |
| `compensated` | 每项已通过身份核对并从场景移除，逆序执行。 |
| `failed` | 出现确定无副作用的拒绝；已成功项会尝试逆序补偿，错误及逐项状态保留。 |
| `needs-review` | 写入、恢复或实例状态不确定；停止后续写入，先查批次、单项操作与场景。只有符合下述双侧读回合同后，显式补偿才能继续。 |

确定失败时，批次会尝试撤销此前成功项。若编辑器结果不明，不会猜测是否已写入。若 `operationId` 没有单项操作记录，恢复只可在资产 SHA/UUID 与预期一致、同一 Creator 实例和 Canvas 仍活动、精确目标节点在实时场景中缺席、并且 `.fire` 读回匹配相同 Canvas UUID 且无该子节点时，把 apply 记录为 `WRITE_RECONCILED_NO_EFFECT` 和 `rejected`。该项不会自动重试；之后显式补偿可以逆序撤销其他已应用项。任何一项读回不匹配或无法执行时，仍保留 `needs-review` 并停止补偿。`scene.sprites.compensate` 为确实已应用的项创建新的补偿操作记录；原操作回执保持历史事实。`scene.sprites.replay` 只接受已完全补偿的来源批次，创建新批次与新操作 ID，并重新运行预检。

## 版本语义与限制

2.4 手册说明图像资源可按 Sprite 类型导入并生成 SpriteFrame 子资源，Sprite 组件引用 SpriteFrame；Canvas 是 UI 场景根节点。本合同要求现有 Canvas，引用 Creator `.meta` 中的 SpriteFrame UUID，并委托既有扩展加载该类型，不自行构造 UUID 或伪造导入结果。[图像资源与 SpriteFrame](https://docs.cocos.com/creator/2.4/manual/zh/asset-workflow/sprite.html)、[Canvas](https://docs.cocos.com/creator/2.4/manual/zh/components/canvas.html)。

批次可写入明确坐标，但**不计算自动布局、不提供图层排序或差异计划，也不代表复杂场景编辑已经解决**。执行后逐项检查 `preview.accept`；若某项在视口外或被遮挡，就不要为该项写预览回执。坐标与画面可见性必须分别验收。

## 验收边界

模拟测试覆盖预检、顺序写入、逐项预览门、坐标校验、相似名称冲突、第二项确定失败后的逆序补偿、不确定写入停止、双侧读回后的 no-effect 对账、阻止自动重试、补偿后重放，以及 Host 单项调用中断后的同批恢复。原中断用例在操作记录和磁盘阶段已持久化但回执未返回时注入异常；再次执行同一 `batchId` 会先通过 `operation.get` 对账，保留原 `operationId` 且不重复写入。新增用例在单项记录不存在时同时核对同一实时实例/Canvas、资源身份与 `.fire` 父子关系，只有目标确实缺席才允许继续显式补偿。上述均是适配器故障注入测试，不代表杀进程或 Creator 重启测试。2026-10-08 在 Creator 2.4.15 `helloworld` 中，以 `(-64,0)` 与 `(64,0)` 放入白色 smoke 和红色 Sprite；`.fire` 读回确认坐标及各自 SpriteFrame UUID，Web 预览同一帧中两张图同时可见，两条预览回执均通过。批次逆序补偿后 Agent 节点数为零，场景文件恢复至测试前 SHA-256 `0963cd0a52e25cdfa3edda47a6e998053885d2b93753da7a5c0da2562728d1a8`。后续经真实 MCP 资源场景请求观测到第二项超时且缺少操作记录；这次没有视觉验收，而是经同一分支证明目标在实时/序列化场景中缺席，逆序补偿第一项后由外层流水线清理两个 PNG 与 `.meta`。完整记录见 [MCP 实机轨迹](traces/cocos-agent-mcp-2.4.jsonl)；原始批次轨迹见[批量场景验收记录](traces/cocos-agent-scene-sprite-batch-2.4-web.jsonl)。
