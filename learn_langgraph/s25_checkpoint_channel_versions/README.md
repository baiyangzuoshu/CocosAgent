# 第 25 课：Checkpoint 如何记录状态与 channel 版本

**目标：** 观察 checkpoint 如何保存 channel 值以及每个 channel 的版本。

## 本课问题

只保存最终 state 字典，为什么不足以表达 Pregel 的 checkpoint？

## 本课增量

每次 channel 写入都更新对应值与版本；未变化的 channel 版本保持不变。

## 源码对照

- [_checkpoint.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/_checkpoint.py)：创建初始 checkpoint，维护 channel values 与 versions。
- [main.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/main.py)：Pregel 在 step 边界生成和使用 checkpoint。

## 代码结构

~~~text
s25_checkpoint_channel_versions/
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
values : {'count': 2, 'answer': 'complete'}
versions: {'count': 3, 'answer': 2}
~~~

## 观察结果

- checkpoint 同时表达 channel 当前值和各自的版本。
- 只修改 answer 时，count 的版本保持不变。

## 简化与边界

- 版本用整数自增模拟；真实 Pregel 允许自定义 channel version 策略。
- 完整 checkpoint 还包含 id、pending sends、metadata、parent config 等字段。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
