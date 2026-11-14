# 第 23 课：Agent 工具循环与状态消息

**要回答的问题：** Agent 怎样根据模型输出调用工具，并把结果追加回消息状态？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/langchain_v1/langchain/agents/factory.py：model node 与条件边`
- `AI/langchain-master/libs/langchain_v1/langchain/tools/tool_node.py：工具执行节点`
- `AI/langchain-master/libs/core/langchain_core/messages/ai.py：AIMessage.tool_calls`
- `AI/langchain-master/libs/core/langchain_core/messages/tool.py：ToolMessage`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
assistant: It is sunny in Tokyo.
messages: 4
~~~

## 本课简化

只运行一轮工具调用；真实 Agent 还要处理多工具、并行调用、错误、结束条件和状态合并。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s23_agent_tool_loop/src/main.py
~~~
