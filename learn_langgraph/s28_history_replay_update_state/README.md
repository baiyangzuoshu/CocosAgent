# 第 28 课：如何查看历史状态、回放运行并更新状态

**目标：** 从历史 checkpoint 选择基点，再生成一个独立的新状态版本。

## 本课问题

修改已有状态时，怎样保留原来的 checkpoint 历史？

## 本课增量

列出历史快照，从较早状态重新执行一个确定性节点，再以该状态为基点应用人工更新并生成分支快照。

## 源码对照

- [main.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/main.py)：get_state_history 读取快照历史，update_state 写入一次状态更新。
- [types.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/types.py)：StateSnapshot 描述配置、值、下一步和任务信息。

## 代码结构

~~~text
s28_history_replay_update_state/
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
history ids: ['c1', 'c2', 'c3']
replay from c1: {'count': 2}
new branch : {'id': 'c3', 'parent': 'c1', 'state': {'count': 1, 'approved': True}}
~~~

## 观察结果

- 从 c1 重放 increment 得到 count=2；从 c1 更新出的 c3 保留 parent=c1，不会覆盖之后的 c2。
- 历史快照让重放、检查和分支更新有明确起点。

## 简化与边界

- replay 是本课显式调用教学节点，不复现 Pregel 的 checkpoint replay 与 task 重用；没有生成真实 RunnableConfig、checkpoint id 或 channel version。
- LangGraph 的 update_state 会按指定节点身份和 channel 语义产生新的 checkpoint。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
