# 附篇 A3：RetrievalQA 到 Runnable RAG

**要回答的问题：** 旧式 RetrievalQA 封装与显式 Runnable RAG 流水线有哪些职责差异？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/langchain/langchain_classic/chains/retrieval.py：RetrievalQA`
- `AI/langchain-master/libs/langchain/langchain_classic/chains/history_aware_retriever.py：history-aware retrieval`
- `AI/langchain-master/libs/core/langchain_core/retrievers.py：BaseRetriever`
- `AI/langchain-master/libs/core/langchain_core/runnables/base.py：RunnableSequence`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
classic: Found: Prefab nodes are cloned.
runnable: Found: Prefab nodes are cloned.
~~~

## 本课简化

两条路径共享内存检索器和假模型；只比较组装边界，不覆盖所有旧链参数与迁移差异。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/a3_retrieval_qa_migration/src/main.py
~~~
