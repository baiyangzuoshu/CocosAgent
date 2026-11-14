# 第 25 课：结构化输出与人工介入边界

**要回答的问题：** Agent 怎样产生结构化响应，并在敏感操作前等待人工决定？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/langchain_v1/langchain/agents/structured_output.py：ToolStrategy、ProviderStrategy`
- `AI/langchain-master/libs/langchain_v1/langchain/agents/middleware/human_in_the_loop.py：approval middleware`
- `AI/langgraph-main/libs/langgraph/langgraph/types.py：interrupt/resume boundary`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
proposal: {'action': 'refund', 'amount': 25}
status: approved
~~~

## 本课简化

暂停状态只保存在局部变量；真实持久化和恢复由 LangGraph checkpointer/interrupt 运行时负责。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s25_agent_human_review/src/main.py
~~~
