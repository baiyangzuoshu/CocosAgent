# 第 1 课：从 StateGraph 到可执行图

**目标：** 分清图的构建阶段和运行阶段，观察节点更新如何沿边进入最终状态。

## 本课问题

StateGraph 怎样经过 compile 变成可执行图？invoke 又怎样沿 START、节点和 END 推进？

## 本课增量

本课注册两个节点，组成一条线性路径：

~~~text
START → clean_question → make_reply → END
~~~

clean_question 只返回被修改的 question；make_reply 只返回新增的 answer。可执行图把节点返回的部分更新合并到本次运行状态中。

## 源码对照

- [graph/state.py：StateGraph](../../AI/langgraph-main/libs/langgraph/langgraph/graph/state.py#L131)：Builder 保存图的状态定义、节点和连线；文档说明 Builder 不能直接执行，需先调用 compile。
- [graph/state.py：add_node](../../AI/langgraph-main/libs/langgraph/langgraph/graph/state.py#L376)：把节点函数加入 Builder。
- [graph/state.py：add_edge](../../AI/langgraph-main/libs/langgraph/langgraph/graph/state.py#L928)：登记节点之间的有向边。
- [graph/state.py：compile](../../AI/langgraph-main/libs/langgraph/langgraph/graph/state.py#L1177)：构建 CompiledStateGraph，并在返回前校验。
- [graph/state.py：CompiledStateGraph](../../AI/langgraph-main/libs/langgraph/langgraph/graph/state.py#L1404)：继承 Pregel，获得图运行时能力。
- [constants.py：START 与 END](../../AI/langgraph-main/libs/langgraph/langgraph/constants.py#L28)：定义图的入口和结束标记。
- [pregel/main.py：Pregel](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/main.py#L456)：运行时按 Plan、Execution、Update 阶段推进。本课先观察公开调用形态，运行阶段细节留到后续课程。

## 实际 LangGraph API 形态

以下片段展示上游 API 的基本调用顺序：

~~~python
from typing_extensions import TypedDict
from langgraph.graph import END, START, StateGraph


class QueryState(TypedDict, total=False):
    question: str
    answer: str


def clean_question(state: QueryState) -> dict:
    return {"question": state["question"].strip()}


def make_reply(state: QueryState) -> dict:
    return {"answer": f"已收到：{state['question']}"}


builder = StateGraph(QueryState)
builder.add_node("clean_question", clean_question)
builder.add_node("make_reply", make_reply)
builder.add_edge(START, "clean_question")
builder.add_edge("clean_question", "make_reply")
builder.add_edge("make_reply", END)

graph = builder.compile()
result = graph.invoke({"question": "  LangGraph 如何运行？  "})
print(result)
~~~

源码快照中的 LangGraph 版本为 1.2.22，Python 要求为 3.10 或更高。上面的 API 片段用于对照源码；本课可运行示例是标准库实现的教学模型。

## 代码结构

~~~text
s01_minimal_stategraph/
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
[compile] entry=clean_question, nodes=2
[invoke] clean_question -> {'question': 'LangGraph 如何运行？'}
[invoke] make_reply -> {'answer': '已收到：LangGraph 如何运行？'}
[result] {'question': 'LangGraph 如何运行？', 'answer': '已收到：LangGraph 如何运行？'}
~~~

## 观察结果

- Builder 保存节点和连线；compile 返回另一个可执行对象。
- invoke 从 START 指向的节点开始，沿登记的边运行，直到 END。
- 节点可以只返回本次修改的字段；最终状态包含初始输入和节点更新。

## 简化与边界

- src/main.py 用 MiniStateGraph 展示构建、编译和调用的分工，不导入或替代 LangGraph。
- 教学模型只支持单条线性路径和同步节点；没有 Reducer、channel、并发、循环、异常恢复、检查点或流式输出。
- 教学模型用 dict.update 合并节点结果。LangGraph 的真实状态更新经 channel 处理；后续课程会拆开讲。
- 上游实现使用 StateGraph 与 Pregel；教学类名带 Mini 前缀，避免与真实 API 混淆。

下一课从 Builder 内部开始，追踪节点定义怎样被保存。
