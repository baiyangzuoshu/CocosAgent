# 第 24 课：Checkpointer 接口负责保存和读取什么

**目标：** 理解 Checkpointer 用配置定位线程并保存 checkpoint 记录。

## 本课问题

运行时为什么通过 Checkpointer 接口而不是直接操作某个数据库？

## 本课增量

用最小 saver 实现 put 与 get，根据 thread_id 和 checkpoint_id 保存、读取快照。

## 源码对照

- [__init__.py](../../AI/langgraph-main/libs/checkpoint/langgraph/checkpoint/base/__init__.py)：BaseCheckpointSaver 定义同步、异步保存与查询契约。
- [__init__.py](../../AI/langgraph-main/libs/checkpoint/langgraph/checkpoint/memory/__init__.py)：内存 saver 用于短期 checkpoint 存储。

## 代码结构

~~~text
s24_checkpointer_interface/
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
loaded: {'values': {'count': 2}}
record count: 1
~~~

## 观察结果

- 运行时只依赖 saver 的保存读取契约，具体存储介质由实现决定。
- checkpoint 至少要能把状态与其线程/检查点身份关联起来。

## 简化与边界

- MiniSaver 只用内存字典，不实现 BaseCheckpointSaver 的完整签名、版本和异步方法。
- 没有线程隔离、serde、父 checkpoint 或历史查询。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
