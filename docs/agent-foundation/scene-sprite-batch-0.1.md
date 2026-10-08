# Creator 2.4 场景 Sprite 批次 0.1

接口 schema：[`scene-sprite-batch.schema.json`](../../tools/cocos-agent-bridge/scene-sprite-batch.schema.json)。此功能是 Host 对既有 `scene.pngSprite` 的顺序编排，只支持 Creator **2.4.15**；它没有新增编辑器侧命令，也不修改 3.8 扩展。

## 输入与阶段

`scene.sprites.plan` 和 `scene.sprites.execute` 接收 `targets`、精确的 `projectRoot`、`creatorVersion="2.4.15"`，以及 2–16 个已导入 PNG 文件名。每项必须位于项目 `assets/resources/`，并有 Creator 生成的 `.meta`。Agent 应先调用 `plan`；它只读验证唯一匹配的目标、活动场景、活动场景下 Canvas、PNG/SpriteFrame 的 UUID 关系、重复文件名和预留节点名冲突。

`execute` 为每个输入项持久分配独立 `operationId`，按顺序调用现有 `scene.pngSprite`，每项检查当前场景、资源摘要、节点名和 SpriteFrame UUID，要求编辑器回执与场景磁盘读回匹配。批次记录在项目 `.cocos-agent/scene-batches/<batchId>.json`；单项记录沿用 `.cocos-agent/operations/<operationId>.json`。相同 `batchId` 重复执行返回已有结果，不产生新节点。

| 批次状态 | 含义与 Agent 后续动作 |
| --- | --- |
| `ready` | `plan` 预检通过；没有写入。 |
| `needs-preview` | 所有节点已保存并逐项读回；尚未证明预览正确。按每项 `operationId` 实际检查 2.4 Web 预览，再分别调用 `preview.accept`。 |
| `completed` | 每项原操作均有通过的磁盘读回与本次预览回执。 |
| `compensated` | 每项已通过身份核对并从场景移除，逆序执行。 |
| `failed` | 出现确定无副作用的拒绝；已成功项会尝试逆序补偿，错误及逐项状态保留。 |
| `needs-review` | 写入、恢复或实例状态不确定；停止后续写入和自动补偿，先查批次、单项操作与场景。 |

确定失败时，批次会尝试撤销此前成功项。若编辑器结果不明，则不会猜测是否已写入。`scene.sprites.compensate` 只接受状态可判定的已应用批次，并为每项创建新的补偿操作记录；原操作回执保持历史事实。`scene.sprites.replay` 只接受已完全补偿的来源批次，创建新批次与新操作 ID，并重新运行预检。

## 版本语义与限制

2.4 手册说明图像资源可按 Sprite 类型导入并生成 SpriteFrame 子资源，Sprite 组件引用 SpriteFrame；Canvas 是 UI 场景根节点。本合同要求现有 Canvas，引用 Creator `.meta` 中的 SpriteFrame UUID，并委托既有扩展加载该类型，不自行构造 UUID 或伪造导入结果。[图像资源与 SpriteFrame](https://docs.cocos.com/creator/2.4/manual/zh/asset-workflow/sprite.html)、[Canvas](https://docs.cocos.com/creator/2.4/manual/zh/components/canvas.html)。

当前单图命令把每个 Sprite 放在 Canvas 原点并设置相同缩放，所以多张图片会重叠。批次只验证资源引用和执行可靠性，**不提供位置、布局、图层排序、差异计划，也不代表复杂场景编辑已经解决**。执行后逐项检查 `preview.accept`；若重叠使某项不可见，就不要为该项写预览回执。不能把同一位置上可见一张图当作其余项都通过。

## 验收边界

模拟测试覆盖预检、顺序写入、逐项预览门、相似名称冲突、第二项确定失败后的逆序补偿、不确定写入停止和补偿后重放。2026-10-08 在 Creator 2.4.15 `helloworld` 中，双项写入后的 `.fire` 读回确认两个 Sprite 分别引用正确的 SpriteFrame UUID；逆序补偿和全新 ID 重放后再次补偿均成功。另一次真实批次中，红色 Sprite 在双项场景预览可见；由于后写入 Sprite 遮住白色 smoke，先为红色记录预览回执，再临时补偿红色使 smoke 可见并记录 smoke 回执，随后由批次本身再次补偿两项。**两项资源都单独通过了预览观察，但本合同不提供布局，尚未验证两张图在同一画面中同时可见。** Creator 保存还会规范化旧 `.fire` 字段；最终文件字节已恢复到测试前 SHA-256，Agent 节点数为零。完整运行轨迹见[批量场景验收记录](traces/cocos-agent-scene-sprite-batch-2.4-web.jsonl)。
