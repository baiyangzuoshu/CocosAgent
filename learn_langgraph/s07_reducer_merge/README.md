# 第 7 课：Reducer 怎样合并多个更新

**目标：** 对比跨 superstep 覆盖与同一步 reducer 聚合两种状态更新方式。

## 本课问题

多个节点在同一个 superstep 写同一个状态键时，默认规则和 reducer 有什么不同？

## 本课增量

count 在两个先后 superstep 中各收到一个值，后一步覆盖前一步；items 在同一步收到两个值，由列表 reducer 聚合。

## 源码对照

- [state.py](../../AI/langgraph-main/libs/langgraph/langgraph/graph/state.py)：State Schema 的 Annotated reducer 会决定字段 channel。
- [binop.py](../../AI/langgraph-main/libs/langgraph/langgraph/channels/binop.py)：BinaryOperatorAggregate 对多次写入应用二元运算。

## 代码结构

~~~text
s07_reducer_merge/
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
merged: {'count': 2, 'items': ['a', 'b']}
~~~

## 观察结果

- 没有 reducer 的 count 每一步最多接收一个值；后续 superstep 的新值会替换旧值。
- items 的 reducer 把同一步收到的多个值按 channel 规则合并到已有值。

## 简化与边界

- 本课按输入列表顺序执行 reducer；真实并发任务的写入会在 Pregel 更新阶段汇总。
- 多写入错误用 ValueError 演示；没有实现 InvalidUpdateError、Overwrite 或 Delta channel。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
