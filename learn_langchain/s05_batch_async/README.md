# 第 5 课：Batch 与异步入口

**要回答的问题：** 同一个 Runnable 怎样处理一组输入，并提供异步批处理入口？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/core/langchain_core/runnables/base.py：Runnable.batch、Runnable.abatch`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
batch: [2, 4, 6]
async batch: [8, 10]
~~~

## 本课简化

示例通过线程池并发调用同步函数；源码还会合并配置、限制并发并支持原生异步实现。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s05_batch_async/src/main.py
~~~
