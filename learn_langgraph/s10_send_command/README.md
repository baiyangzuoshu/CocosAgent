# 第 10 课：Send 与 Command 怎样表达动态路由

**目标：** 区分把多份输入动态派给节点与返回状态更新并指定后继。

## 本课问题

固定边不够时，怎样在运行过程中创建任务或改变下一跳？

## 本课增量

Send 为 worker 创建按项处理的任务；Command 把状态更新和 goto 放在一次返回中。

## 源码对照

- [types.py](../../AI/langgraph-main/libs/langgraph/langgraph/types.py)：Send 携带目标节点与任务参数；Command 携带更新和控制指令。
- [_algo.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/_algo.py)：prepare_next_tasks 合并 PUSH Send 任务与普通边触发任务。

## 代码结构

~~~text
s10_send_command/
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
dynamic tasks: [('score', 'a'), ('score', 'b'), ('score', 'c')]
command: {'needs_review': True} goto human_review
~~~

## 观察结果

- Send 表示运行时追加的目标任务，可为每个任务提供不同参数。
- Command 把状态更新与控制流目标组合起来。

## 简化与边界

- 本课展示数据形状，不执行并行 fan-out 或将 Command 写入 Pregel channel。
- 真实 Command 还有 resume、graph 等字段，具体可用组合以 1.2.22 源码为准。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
