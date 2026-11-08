# 第 0 课：仓库地图与阅读路线

**目标：** 从包结构中找出公开入口、运行编排、模型适配和扩展模块，知道一次源码学习该从哪里开始。

## 本课问题

当示例写下 `Agent(...)` 和 `Runner.run(...)` 时，配置对象、调用循环、模型接口和最终结果分别由哪些模块负责？

## 本地快照

- `engine/openai-agents-python-main/pyproject.toml:1-6`：包名 `openai-agents`、版本 `0.24.0` 和 Python 版本下限。
- `engine/openai-agents-python-main/README.md:10-23`：项目介绍的能力范围，包括 Agent、工具、多 Agent、Guardrails、Session 和 Tracing。
- `engine/openai-agents-python-main/src/agents/__init__.py:9-16`、`:113-124`：将 `Agent`、`Runner` 等符号重导出为包的常用入口。

这里的版本号是本地 `pyproject.toml` 的声明，不表示上游仓库当前版本。后续结论均以本地目录内容为准。

## 目录职责

| 路径 | 主要职责 | 阅读时先看什么 |
| --- | --- | --- |
| `src/agents/agent.py` | Agent 配置、工具和 handoff 能力 | `AgentBase`、`Agent` |
| `src/agents/run.py` | 公共 Runner 门面与一次 Run 的总编排 | `Runner.run`、`Runner.run_sync`、`AgentRunner` |
| `src/agents/run_internal/` | Runner 使用的内部执行细节 | `run_loop.py`、`run_steps.py`、`tool_execution.py` |
| `src/agents/models/` | 模型接口和 OpenAI/其他 Provider 适配 | `interface.py`、`multi_provider.py` |
| `src/agents/tool.py`、`decorators.py` | 工具类型、工具定义和装饰器 | `FunctionTool`、`tool` |
| `src/agents/handoffs/`、`guardrail.py` | Agent 间转交与运行前后检查 | handoff 规范化、Guardrail 结果 |
| `src/agents/items.py`、`result.py`、`run_state.py` | 输入输出条目、运行结果和恢复状态 | `RunItem`、`RunResult`、`RunState` |
| `src/agents/memory/`、`tracing/` | 会话历史持久化和运行追踪 | Session 接口、Trace/Span |
| `src/agents/mcp/`、`sandbox/` | MCP 工具接入与隔离工作区运行 | Server 生命周期、Manifest 和 Session |
| `src/agents/voice/`、`realtime/` | 语音工作流和实时语音会话 | `VoicePipeline`、`RealtimeRunner` |
| `src/agents/extensions/` | 可选 Provider、存储后端和 Sandbox 适配 | 具体扩展的入口与可选依赖 |
| `src/agents/testing/`、`tests/` | 工作流测试替身和 SDK 回归测试 | `ScriptedModel`、`scripted_sandbox_session` |
| `docs/`、`examples/` | 使用指南与端到端样例 | 先定位概念，再回到实现核对 |

## 建议阅读顺序

```text
README 与 pyproject.toml
        ↓
src/agents/__init__.py 的公开重导出
        ↓
agent.py 的 Agent 配置 + run.py 的 Runner 门面
        ↓
run_internal/ 的单轮流程与结果处理
        ↓
models/、tool.py、handoffs/、guardrail.py
        ↓
Session、Tracing、MCP、Sandbox、Voice 与 Realtime
```

`run.py` 是总入口，但核心执行被拆到 `run_internal/`。阅读时先把公共入口和内部实现分开，再顺着实际调用前进；不要因为目录同级，就假定两个能力在运行时有相同先后顺序。

## 一次简单调用的概念图

```text
应用输入
  → Agent 配置
  → Runner 准备输入、上下文和本轮能力
  → Model 接口调用具体模型
  → Runner 处理模型响应
       ├─ 最终输出 → RunResult
       ├─ 工具调用 → 执行工具并继续
       └─ handoff → 切换 Agent 并继续
```

后续课程会逐项拆开这些分支。这里的图只概括普通 Agent 运行的主干，不包含 Session 合并、审批中断、流式消费、Sandbox 和 Realtime 等支线。

## 本课练习

在源码中找到并解释下面四项：

1. 哪个文件声明 `Agent`？
2. 哪个文件导出公开 `Runner`？
3. 一次 Run 的内部单轮执行从哪里开始？
4. `ScriptedModel` 属于生产模型适配器，还是用于确定性工作流测试的工具？

可先读 `agent.py`、`run.py`、`run_internal/run_loop.py` 和 `testing/model.py`，再对照本课表格。

## 本课结果

能把仓库分为公开 API、内部编排、模型适配、工作流能力、运行时扩展和测试工具，并能为一次简单调用选出下一组源码入口。

## 简化与边界

- 源码按职责列出，不代表运行时的完整调用时序；具体顺序要继续跟踪调用点。
- 仓库同时包含核心 Agent、Sandbox、Voice、Realtime 和多个可选扩展，本课只做地图，不展开其生命周期。
- SDK 负责组织 Agent 工作流和调用模型接口；模型服务本身、外部 MCP 服务以及 Sandbox 提供方不属于同一进程内的纯 Python 执行。
