# 第 15 课：Tool Call 与 ToolMessage 往返

**要回答的问题：** 模型请求工具后，工具结果怎样回到下一轮对话？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/core/langchain_core/messages/ai.py：AIMessage.tool_calls`
- `AI/langchain-master/libs/core/langchain_core/messages/tool.py：ToolMessage.tool_call_id`
- `AI/langchain-master/libs/core/langchain_core/tools/base.py：BaseTool.invoke`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
AI requested: get_weather
ToolMessage: sunny in Tokyo (call_id=call-1)
~~~

## 本课简化

一次只执行一个工具调用；源码可处理多个调用、无效参数、并发执行和错误回填。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s15_tool_call_roundtrip/src/main.py
~~~
