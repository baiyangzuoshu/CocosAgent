# 第 11 课：编译前会检查哪些图结构

**目标：** 观察入口、节点和边的引用怎样在执行前被验证。

## 本课问题

一个不存在的目标节点为什么应在 compile 阶段被发现？

## 本课增量

校验器检查是否有 START 入口，以及每条边的起点和终点是否属于已注册节点或 END。

## 源码对照

- [state.py](../../AI/langgraph-main/libs/langgraph/langgraph/graph/state.py)：StateGraph.validate 检查图的入口、节点引用与结束路径。
- [_validate.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/_validate.py)：Pregel 层执行编译后结构校验。

## 代码结构

~~~text
s11_graph_validation/
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
valid graph: accepted
invalid graph: unknown target: missing
~~~

## 观察结果

- 结构错误在调用节点之前就能被拒绝。
- 静态边引用校验与节点运行时的业务逻辑是两个阶段。

## 简化与边界

- 只校验入口和边端点；真实校验还覆盖分支、interrupt 节点和可达性等条件。
- 本课没有判断死循环或动态路由的全部可能目标。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
