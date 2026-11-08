# OpenAI Agents Python SDK 源码学习

以仓库中的 `engine/openai-agents-python-main/` 为源码依据，沿着一次 Agent 运行追踪核心执行链，再逐课学习工具、多 Agent、会话、追踪与运行时扩展。

## 学习方式

1. 先读本课要回答的问题和源码入口。
2. 跟着调用关系阅读本地实现，不把文档描述当作源码证据。
3. 用小例子观察结果；优先使用 `ScriptedModel`，让示例不依赖 API Key 或真实模型输出。
4. 对照源码说明简化点、内部实现边界和当前快照的限制。

课程不重写 SDK。每课的示例互相独立，SDK 源码保持为只读对照材料。需要调用真实模型或外部服务时，会在该课单独标出凭据和服务要求。

## 源码快照

本地 `engine/openai-agents-python-main/pyproject.toml` 标记包版本为 `0.24.0`，要求 Python 3.10 或更新版本。课程中的路径和结论针对这份本地快照；源码更新后，应重新核对路径与行为。

## 课程

- [课程大纲](课程大纲.md)
- 已写：[第 0 课：仓库地图与阅读路线](s00_repository_map/README.md)
- 已写：[第 1 课：Agent 到 Runner 的一次运行](s01_agent_runner/README.md)

其余课程目前只列入大纲，按顺序继续源码学习和实践。

## 课程范围

- 核心运行：Agent、Runner、模型接口、Provider、工具调用和结果。
- 工作流能力：多 Agent 协作、上下文、生命周期回调、Guardrails 和结构化输出。
- 运行状态：流式事件、RunState、Session 与 Tracing。
- 接入方式：MCP、人类审批、Sandbox、Voice、Realtime 和可选扩展。

本课程研究 Python SDK 的本地实现，不覆盖 OpenAI API 的完整平台知识，也不把 SDK 文档中的当前模型名称、价格或服务能力当作长期不变的事实。
