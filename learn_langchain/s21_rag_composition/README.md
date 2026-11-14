# 第 21 课：Runnable 组合成最小 RAG

**要回答的问题：** 检索结果怎样成为模型回答所需的上下文？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/core/langchain_core/retrievers.py：BaseRetriever`
- `AI/langchain-master/libs/core/langchain_core/runnables/base.py：RunnableSequence`
- `AI/langchain-master/libs/core/langchain_core/prompts/chat.py：ChatPromptTemplate`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
answer: Source says: Nodes form a scene tree.
~~~

## 本课简化

检索与模型都由本地确定性函数完成；未涵盖 query rewriting、reranking、引用校验和真实向量库。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s21_rag_composition/src/main.py
~~~
