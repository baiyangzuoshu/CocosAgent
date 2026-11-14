# 第 6 课：流式输出与 Chunk 合并

**要回答的问题：** 模型逐段输出时，Runnable 怎样把数据块传给下游？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/core/langchain_core/runnables/base.py：Runnable.stream、RunnableSequence`
- `AI/langchain-master/libs/core/langchain_core/language_models/chat_model_stream.py：chat model stream`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
chunks: ['LANG', 'CHAIN']
joined: LANGCHAIN
~~~

## 本课简化

示例使用字符串 chunk；真实流还携带 AIMessageChunk、工具调用增量、usage 和结束原因。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s06_streaming_chunks/src/main.py
~~~
