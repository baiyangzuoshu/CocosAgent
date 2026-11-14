# 第 13 课：LastValue 与 EphemeralValue 分别保存什么

**目标：** 对比持久保留的单值和无新写入时会清空的临时值。

## 本课问题

两种 value channel 收到新写入或空更新时有什么不同？

## 本课增量

分别给 LastValue 与 EphemeralValue 写入事件，再在下一步不给临时 channel 新值。

## 源码对照

- [last_value.py](../../AI/langgraph-main/libs/langgraph/langgraph/channels/last_value.py)：LastValue 每个 step 最多接受一个值，并保留当前值。
- [ephemeral_value.py](../../AI/langgraph-main/libs/langgraph/langgraph/channels/ephemeral_value.py)：EphemeralValue 在无新写入时清除前一步的值。

## 代码结构

~~~text
s13_value_channels/
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
step 1: saved event
step 2: saved None
~~~

## 观察结果

- LastValue 没有新写入时保留原值，并限制同一步的写入数量。
- EphemeralValue 没有新写入时清空旧值。

## 简化与边界

- 教学实现用 None 表示空；真实 channel 使用 MISSING，并支持 checkpoint/copy。
- EphemeralValue 还有 guard 配置，真实更新规则以源文件为准。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
