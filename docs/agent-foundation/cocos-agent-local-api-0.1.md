# CocosAgent 本地 Agent 接口 0.1

`tools/cocos-agent-bridge/agent-jsonl.js` 是无网络监听的本地进程接口。Agent 启动后通过 stdin 每行发送一个 JSON 对象，stdout 每行返回 `{ "id": <整数>, "result": ... }`。请求按输入顺序处理；一次进程可处理多行。标准输出只含响应，诊断信息不能混入。它不调用 LLM，不需要模型 Key；Creator 扩展仍通过现有 Host 的本机短时会话工作。

| `method` | `params` | 返回值来源 |
| --- | --- | --- |
| `instances.list` | `targets` | `catalog-host.js` 的完整 `{success,data/error}` |
| `instances.get`、`capabilities.list` | `targets`、`projectRoot`、可选 `creatorVersion` | 同上 |
| `command.execute` | `targets`、`projectRoot`、`creatorVersion`、`command`、`input` | `agent-dispatch.js` 的完整统一结果包 |
| `operation.get` | `projectRoot`、`creatorVersion`、`operationId` | 同上；无需编辑器在线即可读取持久记录 |
| `preview.accept` | `projectRoot`、`creatorVersion`、`operationId`、`evidence` | 同上；只在实际观察本次预览后调用 |

`targets` 是 `{ "creatorVersion": "2.4.15|3.8.7", "projectRoot": "/绝对路径" }` 数组。`command.execute` 仅接受目录中已实现的四个语义命令；Agent 应先查实例和能力，再按对应版本的 skill 构造输入。错误码、`outcome`、六阶段回执及 `needs-review` 的停止重试规则沿用[调度合同](cocos-agent-dispatch-0.1.md)和[操作合同](cocos-agent-operation-contract-0.1.md)。这个接口不添加新的编辑器写入路径，也不授予任意消息或脚本执行权限。

示例：

```sh
node tools/cocos-agent-bridge/agent-jsonl.js
{"id":1,"method":"instances.list","params":{"targets":[{"creatorVersion":"2.4.15","projectRoot":"/绝对路径/2.4.15NewProject"},{"creatorVersion":"3.8.7","projectRoot":"/绝对路径/3.8,7NewProject"}]}}
```

第二行是发送到进程 stdin 的 JSON，不是 Shell 命令。Agent 对 `result.success=false` 的响应应检查结构化 `error.code`；对于 `command.execute` 的 `needs-preview` 或 `needs-review`，还要检查 `result.outcome` 与 `result.operationId`。输入行上限 1 MiB。当前没有并行执行、取消或推送，长时间查询会阻塞后续请求；适合单个本地 Agent 逐步调用。将来增加 MCP 时应包装同一目录与调度合同。

验收：两版已有 `scene.pngSprite` 操作通过 `operation.get` 查询时，本接口的 `result` 与直接运行 `agent-dispatch.js` 完全一致，均为 `completed` 且 `disk/preview=passed`；通过本接口进行的双实例 `instances.list` 返回 2.4.15 `helloworld` 与 3.8.7 `main`，两者均 `ready`。两版各自通过本接口执行只读 `scene.snapshot`，均返回 `completed` 及正确活动场景。本轮未通过本接口再次写场景。结构、错误输入及代理合同测试已通过。记录见[轨迹](traces/cocos-agent-local-api-0.1.jsonl)。
