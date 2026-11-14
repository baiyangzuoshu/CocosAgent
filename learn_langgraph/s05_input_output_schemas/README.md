# 第 5 课：输入与输出 Schema 怎样限定图的边界

**目标：** 区分图内部状态和调用者可见的输入、输出字段。

## 本课问题

图内部可以有中间字段，为什么调用输入和最终输出可以更窄？

## 本课增量

分别用键集合筛选外部输入、内部状态和最终返回值。

## 源码对照

- [state.py](../../AI/langgraph-main/libs/langgraph/langgraph/graph/state.py)：StateGraph 保存 state_schema、input_schema 与 output_schema。
- [state.py](../../AI/langgraph-main/libs/langgraph/langgraph/graph/state.py)：compile 按输入和输出 Schema 选择通道。

## 代码结构

~~~text
s05_input_output_schemas/
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
internal keys: ['answer', 'normalized', 'question']
input state  : {'question': '  运行时边界  '}
final output : {'answer': '已处理：运行时边界'}
~~~

## 观察结果

- 输入过滤决定初始状态允许出现的字段。
- 输出过滤让内部中间字段不必暴露给调用者。

## 简化与边界

- 只演示字段投影，不执行 LangGraph 的 Schema 校验和类型映射。
- 真实 Schema 还会影响 channel 规格和图的输入输出类型。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
