# 第 1 课：Agent 到 Runner 的一次运行

**目标：** 看清 Agent 配置如何进入 Runner，模型响应如何成为 `RunResult.final_output`。

## 本课问题

只有 `Agent` 配置就会自动回答吗？从调用 `Runner.run_sync` 到拿到结果，中间哪些模块负责执行？

## 本课示例

下面用 SDK 自带的 `ScriptedModel` 返回固定文本。它不会访问模型服务；示例观察的是 SDK 的编排路径，不是模型生成质量。

```python
from agents import Agent, Runner
from agents.testing import ScriptedModel, assistant_message

model = ScriptedModel(steps=[[assistant_message("出口在广场东侧。")]])
agent = Agent(
    name="场景导览助手",
    instructions="回答玩家关于场景路线的问题。",
    model=model,
)

result = Runner.run_sync(agent, "出口在哪里？")
print(result.final_output)
model.assert_complete()
```

使用 `engine/openai-agents-python-main/` 已准备好的 Python 环境，从 SDK 仓库根目录运行本课示例：

~~~sh
uv run python ../../learn_openai_agents_python/s01_agent_runner/main.py
~~~

示例文件：[main.py](main.py)。

预期输出：

~~~text
出口在广场东侧。
~~~

这个例子使用 SDK 的公开测试辅助对象，不需要 `OPENAI_API_KEY`；要换成真实模型时，必须另行准备对应的模型服务配置。

## 从示例走到源码

```text
Agent(name, instructions, model)
  → Runner.run_sync(agent, input)
  → AgentRunner.run_sync / _run_sync_impl
  → AgentRunner.run / _run_impl
  → run_single_turn
  → get_new_response
  → Model.get_response
  → 处理响应并生成 RunResult
```

逐段核对：

1. `src/agents/agent.py:323-371`：`Agent` 的 `instructions` 和 `model` 配置；`Agent` 继承 `AgentBase`，共享工具和 MCP 配置。
2. `src/agents/run.py:281-305`：公开异步入口 `Runner.run` 对主循环行为的说明；`:386-407`：同步入口 `run_sync` 及其事件循环限制。
3. `src/agents/run.py:2511-2614`：内部 `AgentRunner.run_sync` 在默认事件循环上运行异步任务；任务进入 `AgentRunner.run`，再由 `:574-610` 归一化 RunConfig 并进入 `_run_impl`。`AgentRunner` 是内部实现，不是课程示例应直接调用的公开入口。
4. `src/agents/run.py:1800-1820`、`:1906-1920`：Run 编排器进入 `run_single_turn` 的位置。
5. `src/agents/run_internal/run_loop.py:2806-2901`：单轮执行准备工具、指令、handoff 和输入，再调用 `get_new_response`。
6. `src/agents/run_internal/run_loop.py:2945-2982`：`get_new_response` 整理模型输入并解析模型与模型设置；`:3045-3070`：Runner 通过 `Model.get_response` 获取模型响应，并交给重试处理。
7. `src/agents/run_internal/turn_preparation.py:134-143`：模型选择顺序。RunConfig 中的模型对象优先，其次是 RunConfig 中的模型名，再其次是 Agent 上的模型对象，最后通过 Provider 取得模型。
8. `src/agents/models/interface.py:37-93`：`Model` 抽象接口的 `get_response` 调用形状；`src/agents/result.py:369-399`：RunResult 的主要可观察字段，包括输入、新生成的 items、原始响应、最终输出和 Guardrail 结果。

`Runner` 和 `Agent` 是应用使用的入口；`AgentRunner`、`run_internal/` 是追踪 SDK 实现时会遇到的内部层。理解主干后，下一课再单独看 Model 和 Provider 边界。

## 可观察结果

- `result.final_output` 是最终文本。
- `model.assert_complete()` 成功说明 Runner 恰好消耗了本课预设的一次模型响应。
- 如果删除预设响应或多余地加入步骤，运行会暴露模型调用次数和配置步骤不一致；这有助于定位工作流是否多走了一轮。

## 简化与边界

- `ScriptedModel` 直接给出预设响应；真实 Model 会执行 Provider/API 适配，本课不验证网络、认证或服务端行为。
- 本课只覆盖一次直接产生文本的调用；工具循环、handoff、Guardrails、中断、Session、streaming 和错误恢复在后续课程展开。
- `Runner.run_sync` 是异步运行流程的同步包装器，不能在已有事件循环的异步函数中使用；异步应用应 `await Runner.run(...)`。
- RunConfig 也可覆盖 Agent 上的模型选择；本课把测试模型放在 Agent 上，以便只观察一条简单路径。
