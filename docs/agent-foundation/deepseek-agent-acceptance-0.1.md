# DeepSeek 驱动的 CocosAgent 编排验收（0.1）

## 目标与状态

本切片验证外部模型能否依据自然语言任务和版本专属 skill，调用本地 Creator 2.4.15 MCP 工具：发现实例、选择就绪目标、查询该目标的能力，再根据回执继续或停止。首个任务限定为只读场景检查。

验收器已实现并通过本地 MCP InMemoryTransport 测试，覆盖多项目发现与选择、能力门槛、节点只读检查、默认拒绝写入、运行轨迹和 DeepSeek HTTP 请求格式。2026-10-10 已完成真实 DeepSeek API 与 Creator 2.4.15 实机联合只读验收；真实调用摘要见 [`cocos-agent-deepseek-readonly-2.4.jsonl`](traces/cocos-agent-deepseek-readonly-2.4.jsonl)。本次 MCP 仅注册 `2.4.15NewProject` 一个项目，因此实测证明了唯一就绪实例选择流程；多个同时就绪候选的真实模型消歧仍只由自动化测试覆盖。

## 执行边界

- 固定调用本地 `mcp-server.mjs`，由启动参数显式注册一个或多个绝对项目路径；当前工具目录只支持 Creator 2.4.15。
- 自然语言任务、`cocos://2x/agent/mcp-tools` MCP Resource 与传入的仓库内 skill 一同进入模型上下文。
- 每个 MCP 工具由模型从已发现目录中选择；本地运行器对目标路径、实例状态和能力合同再次设门。
- 每个模型响应最多允许一个工具调用；运行器等到前一个工具回执返回后，再把控制权交给模型决定下一步。
- 只有收到至少一条成功、未处于待恢复状态的任务工具回执后，运行器才接受模型的“完成”状态；无工具空答不能记作成功。
- 目标必须来自 `instances.list` 返回的已注册、就绪的 2.4.15 实例。项目工具调用前必须成功查询该项目的 `capabilities.list`；专用只读检查与 `command.execute` 还必须在实时目录中显示对应命令 `available`。
- `readOnlyHint` 以外的工具默认需要 `--allow-write` 和本地逐次确认。首轮验收任务明确禁止写入，不应添加 `--allow-write`。
- 若写入回执表示副作用不确定，模型后续只能读取/对账操作记录；未解决时运行以 `needs-review` 结束，不会盲目重试。
- DeepSeek key 只从进程环境或仓库根部被 Git 忽略的 `.env.local` 读取，不接受命令行参数，不传给 MCP 子进程，也不会写入轨迹。

## 运行真实只读验收

先在本机仓库根目录 `.env.local` 配置 `DEEPSEEK_API_KEY`。不要把 key 发到聊天、放进命令参数或提交 Git。随后在 MCP 包目录运行：

```sh
cd tools/cocos-agent-bridge/mcp
node deepseek-agent.mjs \
  --project /Users/youjunmao/WORK/Cocos_Engine/2.4.15NewProject \
  --task '发现注册的 Creator 2.4.15 实例，选择唯一就绪且活动场景为 helloworld 的目标，查询其能力并只读检查 helloworld/Canvas。不要修改项目、启动预览或执行任何写入；如果目标不唯一、实例未就绪或检查能力不可用，说明证据并停止。' \
  --skill plugins/cocos-agent-2x/skills/cocos-agent/SKILL.md \
  --skill plugins/cocos-agent-2x/skills/cocos2-scene-node-operations/SKILL.md
```

可重复 `--project` 注册多个明确的 2.4.15 项目，供模型从目录选择目标；只有编辑器扩展实际连上的实例会显示 `ready`。运行器不接受未注册项目。多项目运行的轨迹保存在第一个注册项目的 `.cocos-agent/agent-runs/`。

DeepSeek 使用 OpenAI 兼容的 Chat Completions 工具调用格式；默认 API 地址为 `https://api.deepseek.com`、模型为 `deepseek-flash`，并显式关闭 thinking 模式。模型名可用 `--model` 覆盖。接口与模型选择细节以 [DeepSeek Tool Calls](https://api-docs.deepseek.com/guides/tool_calls/) 和 [DeepSeek 模型文档](https://api-docs.deepseek.com/quick_start/pricing/) 为准。

## 轨迹与验收记录

每次运行生成一个 JSONL 文件，记录：

- 注册项目、任务文本、MCP 工具与 Resource 目录、skill 路径及哈希；
- 模型轮次、工具名称、参数、工具结果、回执摘要和模型结束原因；
- 写入被允许、拒绝或需要恢复时的决策；
- 最终状态、停止原因、错误代码、操作 ID 与阶段回执。

轨迹位于注册项目 `.cocos-agent/agent-runs/`，文件权限为 `0600`，目录权限为 `0700`。模型私有推理内容不写入轨迹；API key 会从记录中删除。场景检查的成功证据来自 MCP 回执，不会把模型自行描述当成视觉验收。

后续每次实测都在对应轨迹旁记录：DeepSeek 返回的真实工具序列、最终选择的项目及理由、回执与停止原因。若模型因工具错误、目录状态或能力缺失而停下，这也是有效验收结果，不能改写成成功。

### 2026-10-10 真实模型运行记录

- DeepSeek `deepseek-flash` 先调用 `instances.list`、`instances.get`、`capabilities.list`；唯一实例为 2.4.15、`ready`，活动场景 `helloworld`，`scene.snapshot` 与 `scene.node.inspect` 均可用。
- 模型第一次请求快照时把节点名 `Canvas` 传给 `targetNodeName`，收到 `INVALID_ARGUMENT`，回执明确 `sideEffect: none`。它读取错误后移除筛选参数重做只读快照，再以精确路径检查 `helloworld/Canvas`；没有盲目重试写入。
- 快照读回 14 个节点且未截断；Canvas 有 6 个子节点。精确检查回执为 `found`，组件包括 `cc.Canvas`、`HelloWorld`、`cc.Widget`。
- 最终停止原因是 `model_final`，共 6 次 MCP 工具调用。`allowWrite=false`，轨迹中所有调用均为只读，没有写入、构建或预览动作。运行器验证了成功快照和节点检查回执后才接受完成状态。
- 第一次沙箱内 API 请求因网络隔离在任何工具调用前失败；获准联网后重跑完成。API key 未进入成功轨迹。

## 自动化覆盖与限制

`deepseek-agent.test.mjs` 使用模拟模型和 InMemoryTransport 验证了：

1. 从两个注册项目中排除断连实例，选择就绪实例；
2. 查询所选实例的能力后才调用 `scene.node.inspect`；
3. 把 MCP 工具结果回传模型，再以回执生成最终回答；
4. 拒绝同一模型响应中的批量工具请求，确保每次工具选择都基于上一项回执；
5. 没有成功任务工具回执时拒绝模型声称“完成”；
6. 未获 `--allow-write` 时，在调用写工具前停止并记录 `awaiting-approval`；
7. DeepSeek HTTPS 请求格式、错误凭证脱敏、唯一绝对项目路径和 key 不入 CLI。

运行：

```sh
npm test
```

这些自动化测试不访问 DeepSeek、不连接 Creator，也不证明外部模型选择质量；上节的真实模型实测是独立证据。该 harness 面向 2.4.15；不增加或声明 3.8 能力。本轮只验收真实 Agent 的只读调度，尚未验收真实模型发起写入、补偿或重放。
