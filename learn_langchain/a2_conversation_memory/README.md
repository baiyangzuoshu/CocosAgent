# 附篇 A2：Conversation Memory 与历史状态

**要回答的问题：** 旧 Memory 如何把历史读入调用，并在调用后保存新消息？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/langchain/langchain_classic/base_memory.py：BaseMemory`
- `AI/langchain-master/libs/langchain/langchain_classic/memory/buffer_window.py：ConversationBufferWindowMemory`
- `AI/langchain-master/libs/langchain/langchain_classic/chains/base.py：memory load/save lifecycle`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
history: ['u2', 'a2', 'u3', 'a3']
~~~

## 本课简化

只保存在进程内并按消息对数量裁剪；不展示摘要 Memory、实体 Memory 或持久化存储。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/a2_conversation_memory/src/main.py
~~~
