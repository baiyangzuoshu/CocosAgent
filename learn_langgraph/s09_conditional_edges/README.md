# 第 9 课：条件边怎样选择下一节点

**目标：** 把路由函数输出映射成实际目标节点。

## 本课问题

节点运行后，如何按当前状态选择不同后继节点？

## 本课增量

路由函数按优先级返回分类，再由 path_map 把分类映射到节点名。

## 源码对照

- [state.py](../../AI/langgraph-main/libs/langgraph/langgraph/graph/state.py)：add_conditional_edges 保存路由函数与可选 path_map。
- [_branch.py](../../AI/langgraph-main/libs/langgraph/langgraph/graph/_branch.py)：Branch 执行路由并将结果映射为目标节点。

## 代码结构

~~~text
s09_conditional_edges/
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
route label: manual
next node  : human_review
~~~

## 观察结果

- 路由标签和实际节点名可以分开。
- 同一个路由函数可以只返回决策，path_map 负责转换目标。

## 简化与边界

- 只处理一个同步路由结果，不模拟 Send 多任务或 Command 更新。
- 真实 Branch 还负责 Runnable 包装、执行配置和写入任务队列。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
