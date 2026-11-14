# 第 3 课：节点怎样返回部分状态更新

**目标：** 看清节点读取完整状态、返回局部更新，再由运行时合并的过程。

## 本课问题

节点返回的字典为什么可以只包含变化字段？

## 本课增量

用一个节点把计数增加 1。节点只返回 count，合并后 label 等未修改字段继续保留。

## 源码对照

- [state.py](../../AI/langgraph-main/libs/langgraph/langgraph/graph/state.py)：StateGraph 对节点输入状态与节点更新的定义。
- [_node.py](../../AI/langgraph-main/libs/langgraph/langgraph/graph/_node.py)：StateNode 与节点输入规格。

## 代码结构

~~~text
s03_node_partial_updates/
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
input : {'count': 4, 'label': 'draft'}
update: {'count': 5}
state : {'count': 5, 'label': 'draft'}
~~~

## 观察结果

- 节点读取 count 和 label，但只返回新的 count。
- 未出现在更新字典里的键不会因此消失。

## 简化与边界

- 本课用字典展开模拟状态合并；真实 LangGraph 会把更新写入各自的 channel。
- 并发更新和 reducer 语义留到第 7、14、18 课。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
