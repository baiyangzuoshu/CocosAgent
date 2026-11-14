# 第 27 课：thread_id 怎样关联运行与状态快照

**目标：** 观察相同 Checkpointer 如何隔离多个业务线程。

## 本课问题

两次运行使用不同 thread_id 时，状态如何互不覆盖？

## 本课增量

Saver 以 thread_id 为一级键分别写入和读取状态快照。

## 源码对照

- [main.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/main.py)：get_state 从 RunnableConfig 读取 thread_id 并查询 Checkpointer。
- [__init__.py](../../AI/langgraph-main/libs/checkpoint/langgraph/checkpoint/base/__init__.py)：CheckpointTuple 将 checkpoint 与配置关联。

## 代码结构

~~~text
s27_thread_id_snapshots/
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
user-a: {'turn': 2, 'topic': 'rendering'}
user-b: {'turn': 1, 'topic': 'physics'}
~~~

## 观察结果

- thread_id 把多次调用归到同一条可恢复的运行线。
- 不同 thread_id 的 checkpoint 独立保存。

## 简化与边界

- 示例只保存每个线程最新状态，没有 checkpoint_id、namespace 或父子关系。
- 生产使用还需由所选 Checkpointer 实现处理持久化和并发访问。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
