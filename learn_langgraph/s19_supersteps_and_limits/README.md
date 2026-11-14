# 第 19 课：Superstep、循环和递归上限怎样决定运行边界

**目标：** 观察图如何重复推进 step，直到没有后续任务或达到步数上限。

## 本课问题

带循环的图怎样结束，递归上限又是什么作用？

## 本课增量

Planner 根据计数决定是否安排下一轮；循环在达到目标时自然停止，并记录执行 step 数。

## 源码对照

- [_loop.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/_loop.py)：PregelLoop 维护当前 step、stop 与循环生命周期。
- [main.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/main.py)：运行配置校验 recursion_limit，并限制最大 step 数。

## 代码结构

~~~text
s19_supersteps_and_limits/
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
step 1: value=1
step 2: value=2
step 3: value=3
stopped after 3 steps
~~~

## 观察结果

- 每一轮提交后，下一轮的 Plan 会根据新状态决定是否有任务。
- 正常结束与递归上限终止是不同原因。

## 简化与边界

- 示例只有一个计数器 actor；真实 Pregel 会以 channel 变化决定任务集合。
- 本例没有触发上限异常，只展示自然停止路径。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
