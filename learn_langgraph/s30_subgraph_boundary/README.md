# 第 30 课：子图怎样嵌入父图并保持各自的运行边界

**目标：** 观察父图如何把局部输入传给子图，再将结果映射回父状态。

## 本课问题

复用另一张图时，父图与子图的状态字段如何衔接？

## 本课增量

子图使用独立的局部状态和执行函数；父节点显式提取输入并合并返回字段。

## 源码对照

- [state.py](../../AI/langgraph-main/libs/langgraph/langgraph/graph/state.py)：CompiledStateGraph 可作为父图节点，编译时处理子图节点。
- [main.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/main.py)：checkpoint namespace 与 subgraph state 查询保留嵌套运行边界。

## 代码结构

~~~text
s30_subgraph_boundary/
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
parent state: {'question': 'channel', 'answer': '资料：channel'}
child-only key: False
~~~

## 观察结果

- 子图可以有自己的输入和中间字段。
- 父节点负责把子图需要的数据投影出来，并选择哪些结果回写父状态。

## 简化与边界

- 本课只演示显式状态映射；真实 LangGraph 可将编译图直接作为节点并共享兼容字段。
- 没有模拟 checkpoint namespace、stream 子图事件、嵌套中断或状态转换。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
