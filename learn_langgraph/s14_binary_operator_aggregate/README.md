# 第 14 课：BinaryOperatorAggregate 怎样应用 reducer

**目标：** 观察一个 channel 如何把当前值与每次新写入逐个合并。

## 本课问题

多个节点为同一个累加字段写入时，聚合值怎样形成？

## 本课增量

以加法聚合器接收三个更新，并逐个把新值合并到 channel 当前值。

## 源码对照

- [binop.py](../../AI/langgraph-main/libs/langgraph/langgraph/channels/binop.py)：BinaryOperatorAggregate 初始化初值并逐个应用二元运算。
- [base.py](../../AI/langgraph-main/libs/langgraph/langgraph/channels/base.py)：BaseChannel 定义 update、get 与 checkpoint 等接口。

## 代码结构

~~~text
s14_binary_operator_aggregate/
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
aggregate: 10
~~~

## 观察结果

- channel 保存聚合后的当前值，而不是把所有更新原样覆盖。
- 同一批写入按收到的顺序逐个交给 reducer。

## 简化与边界

- 只展示整数加法，不处理类型构造初值、Overwrite、Delta snapshots 或错误。
- 聚合结果依赖 reducer；任意 reducer 并不都满足交换律。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
