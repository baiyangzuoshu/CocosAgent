# CocosAgent 操作合同 0.1：PNG 放入场景

本合同当前只覆盖 `scene.pngSprite`：把已导入的 PNG 对应 SpriteFrame 放入当前场景，以及按身份补偿、重放。机器可读定义在 [`operation.schema.json`](../../tools/cocos-agent-bridge/operation.schema.json)。`operationId` 当前使用一次 Host 会话 ID；跨会话持久操作日志和稳定幂等键尚未实现。

| 阶段 | 输入与执行方 | 通过证据 | 失败状态 |
| --- | --- | --- | --- |
| `capability` | Host 核对两版扩展的 `operationContract`、版本和动作列表 | 扩展 `hello` 的能力声明 | `UNSUPPORTED_CAPABILITY` 或协议不匹配；无场景副作用 |
| `preflight` | Host 提交资源 UUID、保留节点名、动作；2.4/3.8 各自检查当前场景和目标节点 | `create`、`alreadyApplied`、`remove`、`alreadyAbsent` 与 Canvas 名称 | `NO_OPEN_SCENE`、`CANVAS_NOT_FOUND`、`SCENE_NODE_CONFLICT` 等；无场景副作用 |
| `editor` | 两版扩展分别执行创建或删除，并请求各自编辑器保存 | 节点身份、SpriteFrame UUID、保存回执 | 执行失败；可能已有局部副作用，不能盲目重试 |
| `disk` | Host 读回唯一活动场景文件，再向编辑器读取目标节点快照 | 节点与 SpriteFrame 引用、父 Canvas；补偿时检查节点缺席 | `SCENE_SAVE_UNVERIFIED`；需先重新读状态 |
| `preview` | 当前由人或桌面控制启动 Web 预览并目视确认 | `visual-preview` 证据需带观察时间与环境 | Host 当前只输出 `pending`，不自动宣称通过 |
| `recovery` | `compensate` 按节点名和 SpriteFrame UUID 清理；`replay` 再创建 | 补偿后内存、磁盘均无目标节点 | 身份冲突或保存失败时保留现场；不删除不匹配节点 |

`receipt.status` 只能是 `passed`、`failed`、`pending`、`skipped`。`failed` 必须带结构化 `error`，包括所属阶段、可重试性和可能的副作用。`passed` 必须带至少一条证据。Host 以 `operation.receipt {JSON}` 输出阶段回执；当前预览始终为 `pending`，即使此前人工验收过同一示例，也不能复用作新操作的自动验收。

版本实现必须独立：2.4 使用现有 Canvas 与 `Editor.Scene.callSceneScript`，3.8 可创建专用 Canvas/UI 相机并使用 `Editor.Message.request`。共用合同约束任务语义和证据字段，不要求两个版本共用编辑器 API。现阶段 `asset.importPng` 和只读 `scene.snapshot` 仍使用原有桥接消息；未来扩大合同范围时再分别定义资源导入与查询能力。
