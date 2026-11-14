# 第 26 课：Pending writes 怎样保留已完成节点的写入

**目标：** 理解同一步部分任务完成后，已完成任务结果如何供恢复流程复用。

## 本课问题

一个并行任务失败时，为什么不必丢掉同一步其他成功任务的结果？

## 本课增量

第一次运行保存成功任务的 pending write，失败任务重试时复用前者并只重新运行失败任务。

## 源码对照

- [_loop.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/_loop.py)：PregelLoop 把任务写入暂存并与 checkpoint 协作。
- [_runner.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/_runner.py)：Runner 对任务执行、失败与重试进行协调。

## 代码结构

~~~text
s26_pending_writes/
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
first attempt: right failed; pending: ['left']
calls: {'left': 1, 'right': 2} committed: {'left': {'left': 3}, 'right': {'right': 4}}
~~~

## 观察结果

- left 的结果先进入 pending，不必因 right 失败而重新计算。
- 所有任务结果齐备后，运行时再提交完整 step 的 channel 更新。

## 简化与边界

- 例子将失败模拟为一次异常；真实恢复还依赖 task id、checkpoint id 与 saver 的 put_writes。
- 不涵盖中断、持久化失败或重试退避策略。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
