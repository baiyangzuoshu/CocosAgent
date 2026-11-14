# 第 18 课：Document 与 Loader

**要回答的问题：** 加载得到的文本怎样带着来源元数据进入后续处理？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/core/langchain_core/documents/base.py：Document、BaseMedia`
- `AI/langchain-master/libs/core/langchain_core/document_loaders/base.py：BaseLoader.lazy_load、load`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
source=guide.md
content=Use a Runnable to compose steps.
~~~

## 本课简化

只从内存记录加载；真实 Loader 还处理文件、网页、Blob、分页、编码和加载错误。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s18_document_loader/src/main.py
~~~
