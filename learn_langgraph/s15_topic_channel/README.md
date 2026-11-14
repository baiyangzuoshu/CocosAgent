# 第 15 课：Topic channel 怎样累积一轮中的多个更新

**目标：** 区分每步清空的 PubSub topic 和跨步累积模式。

## 本课问题

Topic 的 accumulate 选项如何改变前一步数据的保留方式？

## 本课增量

本课把 topic 分别设为非累积和累积，比较连续两步写入后的读取值。

## 源码对照

- [topic.py](../../AI/langgraph-main/libs/langgraph/langgraph/channels/topic.py)：Topic 扁平化写入，并按 accumulate 选项清空或保留旧值。
- [base.py](../../AI/langgraph-main/libs/langgraph/langgraph/channels/base.py)：channel 的统一更新与读取接口。

## 代码结构

~~~text
s15_topic_channel/
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
batch: ['a', 'b'] per_step: ['a', 'b'] history: ['a', 'b']
batch: ['c'] per_step: ['c'] history: ['a', 'b', 'c']
~~~

## 观察结果

- accumulate=False 时新一轮写入前先清空旧 topic 值。
- accumulate=True 时值跨 step 保留并继续追加。

## 简化与边界

- 没有模拟真实 Topic 对 list 写入的扁平化、checkpoint 和可用性判断。
- topic 是传递多值的 channel；它与 reducer 对单个状态值的聚合语义不同。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
