# 第 26 课：MCP Adapter 与外部工具

**要回答的问题：** MCP Server 暴露的工具怎样映射成 LangChain 可调用工具？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/langchain_v1/langchain/mcp/adapter.py：MCPAdapter`
- `AI/langchain-master/libs/langchain_v1/langchain/mcp/tools.py：MCP tools`
- `AI/langchain-master/libs/langchain_v1/langchain/mcp/elicitation.py：elicitation boundary`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
tools: ['lookup']
result: record-7
~~~

## 本课简化

Server 是内存对象，不实现 MCP transport、session 生命周期、认证、重连或 elicitation。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s26_mcp_adapter/src/main.py
~~~
