# 第 2 课：RunnableSequence 顺序组合

**要回答的问题：** 怎样把多个 Runnable 接成一条按顺序传值的链？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/core/langchain_core/runnables/base.py：RunnableSequence、Runnable.pipe、__or__`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
CORE!
~~~

## 本课简化

只实现同步顺序调用；源码还处理嵌套序列、类型、回调、流式和异步执行。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s02_sequence_composition/src/main.py
~~~
