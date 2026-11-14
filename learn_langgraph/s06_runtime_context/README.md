# 第 6 课：context_schema 怎样传递本次运行的上下文

**目标：** 区分可变图状态和供节点读取的运行时上下文。

## 本课问题

用户身份或策略参数为什么不一定要写进图状态？

## 本课增量

节点从独立的只读上下文读取语言偏好，最终状态只保留业务输入和输出。

## 源码对照

- [runtime.py](../../AI/langgraph-main/libs/langgraph/langgraph/runtime.py)：Runtime 将 context、store 与 stream_writer 等能力提供给节点。
- [state.py](../../AI/langgraph-main/libs/langgraph/langgraph/graph/state.py)：StateGraph 的 context_schema 声明运行时上下文类型。

## 代码结构

~~~text
s06_runtime_context/
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
result: {'name': 'Mika', 'reply': '你好: Mika'}
context copied into state: False
~~~

## 观察结果

- 节点同时接收状态和 Runtime；上下文不自动成为状态字段。
- 上下文适合本次调用需要读取、但不需要沿图更新的依赖。

## 简化与边界

- MappingProxyType 只模拟只读上下文；真实 Runtime 还暴露其他运行能力。
- 本课没有实现 Store、Runtime 的泛型类型或上下文继承。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
