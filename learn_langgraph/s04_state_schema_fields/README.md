# 第 4 课：State Schema 怎样定义共享状态

**目标：** 从状态类型的字段得到图状态键的初步模型。

## 本课问题

State Schema 描述的是节点还是图运行中共享的数据？

## 本课增量

使用 TypedDict 声明 question、answer 两个字段，并从类型注解读取字段名和类型。

## 源码对照

- [state.py](../../AI/langgraph-main/libs/langgraph/langgraph/graph/state.py)：StateGraph 接收 state_schema 并为字段建立状态通道。
- [state.py](../../AI/langgraph-main/libs/langgraph/langgraph/graph/state.py)：_get_channels 将 Schema 字段转成 channel 规格。

## 代码结构

~~~text
s04_state_schema_fields/
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
state keys: ['question', 'answer']
field types: {'question': 'str', 'answer': 'str'}
~~~

## 观察结果

- Schema 的字段是图中可读写的状态键。
- 本课只是读取类型注解，尚未把每个键连接到 channel 实例。

## 简化与边界

- 没有处理 Annotated、reducer、managed value、Pydantic 或 dataclass Schema。
- State Schema 不会自动把任意业务对象变成可持久化对象。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
