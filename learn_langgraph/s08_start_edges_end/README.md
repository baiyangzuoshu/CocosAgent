# 第 8 课：START、普通边与 END 怎样确定执行顺序

**目标：** 观察入口边、节点间边和结束边如何组成一条有向路径。

## 本课问题

没有入口边时运行从哪里开始，节点到哪里才算结束？

## 本课增量

沿 START 到两个节点再到 END 追踪路径，并在每个节点进入时记录顺序。

## 源码对照

- [constants.py](../../AI/langgraph-main/libs/langgraph/langgraph/constants.py)：START 与 END 是图运行时使用的特殊边界标记。
- [state.py](../../AI/langgraph-main/libs/langgraph/langgraph/graph/state.py)：add_edge 登记普通边，set_entry_point 与 set_finish_point 是便捷入口。

## 代码结构

~~~text
s08_start_edges_end/
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
node order: ['load', 'normalize']
stopped at: __end__
~~~

## 观察结果

- START 通过一条入口边选择第一个节点。
- END 是运行终点标记，不是普通业务节点。

## 简化与边界

- 只走一条固定路径；条件分支和并行边在后续课程处理。
- 示例的字典路由不表示上游 Pregel 的 channel 订阅机制。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
