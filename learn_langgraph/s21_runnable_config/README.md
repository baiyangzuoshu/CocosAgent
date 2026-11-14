# 第 21 课：RunnableConfig 怎样影响一次图运行

**目标：** 观察一次调用的元数据与运行限制如何作为配置传入。

## 本课问题

thread_id、tags 和 recursion_limit 属于状态还是运行配置？

## 本课增量

把可继承的 tags、metadata 与本次调用的 configurable 和 recursion_limit 合并。

## 源码对照

- [_config.py](../../AI/langgraph-main/libs/langgraph/langgraph/_internal/_config.py)：ensure_config 和配置合并辅助函数。
- [_config.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/_config.py)：Pregel 从 RunnableConfig 读取运行时选项。

## 代码结构

~~~text
s21_runnable_config/
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
resolved config: {'tags': ['course', 'demo'], 'metadata': {'lesson': 21}, 'recursion_limit': 8, 'configurable': {'thread_id': 'case-7'}}
graph state contains thread_id: False
~~~

## 观察结果

- 配置影响一次运行的追踪、可配置参数或执行限制。
- thread_id 放在 configurable 中用于定位持久化线程，不自动变成图状态字段。

## 简化与边界

- 只演示 tags 追加、recursion_limit 覆盖和 configurable 合并；真实 RunnableConfig 还处理 callbacks、metadata 及 checkpoint 坐标继承规则。
- thread_id 在本课只作为配置值，不连接 Checkpointer。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
