# 第 24 课：Agent Middleware 调用包装

**要回答的问题：** Middleware 怎样在模型调用前后观察或修改请求？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/langchain_v1/langchain/agents/middleware/types.py：AgentMiddleware、wrap_model_call、wrap_tool_call`
- `AI/langchain-master/libs/langchain_v1/langchain/agents/middleware/_execution.py：middleware execution`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
result: HELLO
middleware: ['before', 'after']
~~~

## 本课简化

只实现同步模型包装；源码还包括异步 hook、状态读写、短路返回和错误 hook。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s24_agent_middleware/src/main.py
~~~
