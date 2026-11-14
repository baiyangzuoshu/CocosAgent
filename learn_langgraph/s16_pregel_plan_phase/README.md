# 第 16 课：Plan 阶段怎样选出本轮要运行的节点

**目标：** 根据上一步变更的 channel 找到订阅它们的 actor。

## 本课问题

一个 channel 更新后，哪些节点会进入下一轮任务集合？

## 本课增量

Planner 反查订阅关系，只选择读取了本轮变化 channel 的节点。

## 源码对照

- [_algo.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/_algo.py)：prepare_next_tasks 根据 channel 触发关系构造下个 step 的任务。
- [main.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/main.py)：Pregel 以 Plan、Execution、Update 三阶段重复执行。

## 代码结构

~~~text
s16_pregel_plan_phase/
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
updated channels: ['question']
planned nodes  : ['audit', 'classify']
~~~

## 观察结果

- Planner 根据 channel 更新选择任务，而不是每轮重新运行所有节点。
- 一个 channel 可以触发多个订阅它的 actor。

## 简化与边界

- 示例用集合表示触发关系；真实 prepare_next_tasks 同时处理 PUSH Send、PULL 节点、缓存与 checkpoint。
- 此处只展示 Plan，不代表节点已经执行。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
