# 第 2 课：Builder 怎样保存节点定义

**目标：** 观察 Builder 如何登记节点函数和连线，而不在登记时执行节点。

## 本课问题

调用 add_node 与 add_edge 后，Builder 中保存了什么？

## 本课增量

本课把节点名映射到函数，并把边保存为有序记录。只有显式调用节点函数时才发生业务计算。

## 源码对照

- [state.py](../../AI/langgraph-main/libs/langgraph/langgraph/graph/state.py)：StateGraph 保存 nodes、edges、branches 等构图数据。
- [_node.py](../../AI/langgraph-main/libs/langgraph/langgraph/graph/_node.py)：节点规格和 Runnable 包装类型。

## 代码结构

~~~text
s02_builder_node_registry/
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
registered nodes: ['clean', 'reply']
registered edges: [('clean', 'reply')]
node calls during registration: 0
~~~

## 观察结果

- nodes 保存名称到节点函数的对应关系。
- edges 保存声明的连线；登记动作本身不调用节点。

## 简化与边界

- 只保留节点函数和普通边，未模拟上游的 StateNodeSpec、Runnable 转换、元数据与分支。
- 本课 Builder 不做图校验；编译验证在第 11 课展开。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
