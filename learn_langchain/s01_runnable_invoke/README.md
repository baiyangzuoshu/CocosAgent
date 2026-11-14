# 第 1 课：Runnable 协议与单次调用

**要回答的问题：** 普通 Python 函数怎样获得统一的 LangChain 调用入口？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/core/langchain_core/runnables/base.py：Runnable.invoke、RunnableSerializable`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
LANGCHAIN
~~~

## 本课简化

只保留同步 invoke；源码还提供 stream、batch、async、配置和序列化能力。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s01_runnable_invoke/src/main.py
~~~
