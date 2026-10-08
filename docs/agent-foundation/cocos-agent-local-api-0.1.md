# CocosAgent 本地 Agent 接口 0.1

`tools/cocos-agent-bridge/agent-jsonl.js` 是无网络监听的本地进程接口。Agent 启动后通过 stdin 每行发送一个 JSON 对象，stdout 每行返回 `{ "id": <整数>, "result": ... }`。请求按输入顺序处理；一次进程可处理多行。标准输出只含响应，诊断信息不能混入。它不调用 LLM，不需要模型 Key；Creator 扩展仍通过现有 Host 的本机短时会话工作。

| `method` | `params` | 返回值来源 |
| --- | --- | --- |
| `instances.list` | `targets` | `catalog-host.js` 的完整 `{success,data/error}` |
| `instances.get`、`capabilities.list` | `targets`、`projectRoot`、可选 `creatorVersion` | 同上 |
| `command.execute` | `targets`、`projectRoot`、`creatorVersion`、`command`、`input` | `agent-dispatch.js` 的完整统一结果包 |
| `operation.get` | `projectRoot`、`creatorVersion`、`operationId` | 同上；无需编辑器在线即可读取持久记录 |
| `operation.reconcile` | `targets`、`projectRoot`、`creatorVersion`、`operationId` | 仅对可对账的历史失败写入进行同场景内存与磁盘读回；不重发编辑器写入 |
| `preview.accept` | `projectRoot`、`creatorVersion`、`operationId`、`evidence` | 同上；只在实际观察本次预览后调用 |
| `workflow.plan/execute/get/compensate/replay` | 场景节点计划、`workflowId` 或 `sourceWorkflowId` | [场景组合合同](scene-composition-0.1.md)；持久记录与逐步回执 |
| `assets.batch.plan/execute/get` | PNG 源路径清单、`batchId` | [批量导入合同](asset-batch-0.1.md)；逐项结果与磁盘读回 |
| `scene.sprites.plan/execute/get/compensate/replay` | 已导入 PNG 名称、可选的 `positions`、`batchId` 或 `sourceBatchId` | [2.4 场景 Sprite 批次合同](scene-sprite-batch-0.1.md)；逐项场景操作、Canvas 坐标、预览门和补偿；当前只实现 2.4 |
| `assets.scene.plan/execute/get/preview.accept/compensate/validate/repair` | PNG 源路径清单、`pipelineId`、逐项预览证据或资源名 | [2.4 资源到场景流水线](cocos-agent-resource-scene-pipeline-0.1.md)；串联导入、UUID 校验、场景引用、预览和身份校验回滚；validate 只读检查，repair 仅刷新唯一失配的 AssetDB URL 映射；当前只实现 2.4 |
| `content.plan/stage/get/select/rollback` | 本地内容清单、`releaseId`、预期当前版本 | [动态内容本地版本合同](content-release-0.1.md)；只管理 Host 版本记录与指针，不改变运行时 |
| `content.fromScene.plan/stage` | 已完成的 2.4 资源场景 `pipelineId`、入口 PNG、稳定资源 ID 映射与 `releaseId` | 从已验收场景流水线派生不可变 `resources` 清单；重新核验 AssetDB、UUID 与运行时路径，只暂存版本，不自动选中或构建 |
| `content.runtime.accept` | `projectRoot`、`creatorVersion`、`platform=web-preview`、运行时成功回执 | 核对当前选中版本/指纹/资源 UUID，另记 `effective`；本地调用者回执尚未认证 |
| `content.build.plan/execute/get/reconcile` | 已选择的 2.4.15 release、预期指纹与唯一 `buildId` | 调用 Creator 2.4.15 CLI 构建 Web-Mobile 到新隔离路径，再核对 resources bundle、Texture2D UUID、导入 JSON 与 PNG 文件；reconcile 只读恢复 Host 中断记录；真实 Creator 包格式尚待实机验收 |

组合和批量方法只编排已实现的语义命令，不授予任意脚本执行权限。当前 `command.execute` 目录在 2.4.15 有八项，在 3.8.7 有五项；`asset.removeImportedPng`、`asset.validatePng` 和 `asset.refreshPng` 只由 2.4 扩展提供。

`targets` 是 `{ "creatorVersion": "2.4.15|3.8.7", "projectRoot": "/绝对路径" }` 数组。`command.execute` 仅接受所选版本目录中的语义命令；Agent 应先查实例和能力，再按对应版本的 skill 构造输入。错误码、`outcome`、六阶段回执及 `needs-review` 的停止重试规则沿用[调度合同](cocos-agent-dispatch-0.1.md)和[操作合同](cocos-agent-operation-contract-0.1.md)。资源流水线在 Host 侧组合这些命令，不授予任意消息或脚本执行权限。

示例：

```sh
node tools/cocos-agent-bridge/agent-jsonl.js
{"id":1,"method":"instances.list","params":{"targets":[{"creatorVersion":"2.4.15","projectRoot":"/绝对路径/2.4.15NewProject"},{"creatorVersion":"3.8.7","projectRoot":"/绝对路径/3.8,7NewProject"}]}}
```

第二行是发送到进程 stdin 的 JSON，不是 Shell 命令。Agent 对 `result.success=false` 的响应应检查结构化 `error.code`；对于 `command.execute` 的 `needs-preview` 或 `needs-review`，还要检查 `result.outcome` 与 `result.operationId`。输入行上限 1 MiB。当前没有并行执行、取消或推送，长时间查询会阻塞后续请求；适合单个本地 Agent 逐步调用。将来增加 MCP 时应包装同一目录与调度合同。

验收：两版已有 `scene.pngSprite` 操作通过 `operation.get` 查询时，本接口的 `result` 与直接运行 `agent-dispatch.js` 完全一致，均为 `completed` 且 `disk/preview=passed`；通过本接口进行的双实例 `instances.list` 返回 2.4.15 `helloworld` 与 3.8.7 `main`，两者均 `ready`。两版各自通过本接口执行只读 `scene.snapshot`，均返回 `completed` 及正确活动场景。本轮未通过本接口再次写场景。结构、错误输入及代理合同测试已通过。记录见[轨迹](traces/cocos-agent-local-api-0.1.jsonl)。
