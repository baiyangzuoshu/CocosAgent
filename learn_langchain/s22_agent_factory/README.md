# 第 22 课：create_agent 工厂与执行图

**要回答的问题：** 公开 Agent 工厂怎样把模型、工具和状态协议组装为可运行对象？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/langchain_v1/langchain/agents/factory.py：create_agent、graph assembly`
- `AI/langchain-master/libs/langchain_v1/langchain/agents/__init__.py：public API`
- `AI/langgraph-main/libs/langgraph/langgraph/graph/state.py：StateGraph boundary`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
nodes: ['model', 'tools', 'model']
tools: ['weather']
~~~

## 本课简化

这里只展示工厂组装职责，不复刻 LangGraph StateGraph、编译、检查点和并发运行时。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s22_agent_factory/src/main.py
~~~
