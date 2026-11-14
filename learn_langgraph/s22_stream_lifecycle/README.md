# 第 22 课：stream 与 astream 怎样逐步产出运行结果

**目标：** 观察生成器如何在图运行过程中逐步交付结果。

## 本课问题

stream 与一次性 invoke 的返回时机有什么不同？

## 本课增量

用 `updates` 模式把每个节点的局部更新作为事件 yield；消费者在图完成前即可读取事件。

## 源码对照

- [main.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/main.py)：Pregel 的 stream 与 astream 运行入口。
- [run_stream.py](../../AI/langgraph-main/libs/langgraph/langgraph/stream/run_stream.py)：运行流封装事件的消费生命周期。

## 代码结构

~~~text
s22_stream_lifecycle/
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
{'clean': {'question': '流式执行'}}
{'reply': {'answer': '已收到：流式执行'}}
~~~

## 观察结果

- 消费者在每个 yield 点收到中间结果，而不必等最终状态。
- stream 输出流和图内部状态是相关但不同的观察面。

## 简化与边界

- 同步生成器只模拟事件交付；真实 astream 还处理异步任务、取消和流资源关闭。
- 没有实现其他 stream_mode 和多种事件协议；这里也不额外产生最终状态事件。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
