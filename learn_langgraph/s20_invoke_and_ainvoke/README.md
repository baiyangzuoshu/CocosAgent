# 第 20 课：invoke 与 ainvoke 怎样调用已编译图

**目标：** 比较同步与异步调用入口如何产生相同的图结果。

## 本课问题

什么时候使用 invoke，什么时候需要 ainvoke？

## 本课增量

同一个确定性节点分别经同步包装和 async 包装调用，结果状态保持一致。

## 源码对照

- [main.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/main.py)：Pregel 实现 invoke 与 ainvoke 两种单次调用入口。
- [protocol.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/protocol.py)：PregelProtocol 声明同步与异步 Runnable 接口。

## 代码结构

~~~text
s20_invoke_and_ainvoke/
├── README.md
└── src/
    └── main.py
~~~

## 运行

在本课目录执行：

~~~sh
python3 src/main.py
~~~

预期输出：

~~~text
invoke : {'question': '图运行时', 'answer': '收到：图运行时'}
ainvoke: {'question': '图运行时', 'answer': '收到：图运行时'}
~~~

## 观察结果

- 两个入口都执行同一图逻辑，并返回最终状态。
- 异步入口允许节点和调用链使用 await，不代表必然更快。

## 简化与边界

- 没有复现 RunnableConfig、callbacks、stream、batch 或并发 actor 调度。
- 示例的 asyncio.sleep 仅表示异步边界，不访问外部资源。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
