# 第 17 课：Runner 怎样启动并管理节点任务

**目标：** 观察同一个 Pregel step 中多个任务可以并发执行。

## 本课问题

Planner 产生多个任务后，Runner 如何等它们完成？

## 本课增量

用 Python 线程池并发执行两个纯函数任务，再按任务名整理结果，避免完成顺序影响展示。

## 源码对照

- [_runner.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/_runner.py)：PregelRunner 接收任务集合并协调并发、写入与失败。
- [_executor.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/_executor.py)：执行器提供任务提交与并行运行能力。

## 代码结构

~~~text
s17_pregel_task_runner/
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
submitted: ['alpha', 'beta']
results  : {'alpha': ('alpha', 50), 'beta': ('beta', 40)}
~~~

## 观察结果

- 任务都由同一个 step 的执行器提交，调用者在本例中等待全部结果。
- 结果的展示顺序由任务名决定，不依赖线程完成先后。

## 简化与边界

- 仅演示并发提交和汇合；真实 PregelRunner 还协调中断、取消、错误处理、重试与 checkpoint 写入。
- 线程池不是 LangGraph 的执行器实现。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
