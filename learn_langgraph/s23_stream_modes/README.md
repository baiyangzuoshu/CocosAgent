# 第 23 课：不同 stream mode 分别暴露哪些结果

**目标：** 用相同节点更新对比 updates、values 和 debug 三种观察方式。

## 本课问题

查看节点差量、完整状态或执行事件时，流内容有什么区别？

## 本课增量

把同一条执行轨迹投影成局部更新、累计状态和调度事件三种输出。

## 源码对照

- [main.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/main.py)：stream_mode 控制 Pregel 运行输出类别。
- [_types.py](../../AI/langgraph-main/libs/langgraph/langgraph/stream/_types.py)：流式数据类型和事件结构定义。

## 代码结构

~~~text
s23_stream_modes/
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
updates: ('clean', {'question': 'stream'})
values : {'question': 'stream'}
debug  : {'event': 'task_end', 'node': 'clean'}
updates: ('reply', {'answer': 'done'})
values : {'question': 'stream', 'answer': 'done'}
debug  : {'event': 'task_end', 'node': 'reply'}
~~~

## 观察结果

- updates 适合观察节点各自写了什么。
- values 适合观察每步提交后的状态；debug 则携带运行事件信息。

## 简化与边界

- 此处只模拟三种输出形状；真实 stream modes 还包括 messages、custom、tasks、checkpoints 与 v2 事件包装。
- 真实输出形状随 mode 和 version 参数而不同。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
