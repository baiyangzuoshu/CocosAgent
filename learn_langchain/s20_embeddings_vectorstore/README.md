# 第 20 课：Embedding、VectorStore 与 Retriever

**要回答的问题：** 查询怎样根据向量相似度返回最相关的 Document？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/core/langchain_core/embeddings/embeddings.py：Embeddings`
- `AI/langchain-master/libs/core/langchain_core/vectorstores/base.py：VectorStore、VectorStoreRetriever`
- `AI/langchain-master/libs/core/langchain_core/retrievers.py：BaseRetriever.invoke`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
top match: cats drink milk
~~~

## 本课简化

用词频和内存列表演示检索契约；生产向量库涉及 embedding 模型、索引、过滤、持久化和距离度量。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s20_embeddings_vectorstore/src/main.py
~~~
