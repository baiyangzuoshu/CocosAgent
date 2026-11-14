# 第 12 课：compile 怎样把 StateGraph 降成 Pregel 图

**目标：** 从 Builder 的节点与边映射到运行时 actor、channel 的初步形状。

## 本课问题

Builder 保存的声明怎样变成 Pregel 可调度的节点？

## 本课增量

编译器为节点生成 actor 记录，把入口和节点连接变成触发 channel，并保留输出字段映射。

## 源码对照

- [state.py](../../AI/langgraph-main/libs/langgraph/langgraph/graph/state.py)：StateGraph.compile 构造 CompiledStateGraph 并连接节点、分支和 channel。
- [main.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/main.py)：Pregel 是执行 actor 与 channel 的运行时。

## 代码结构

~~~text
s12_compile_to_pregel/
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
actors: {'clean': {'triggers': ['branch:to:clean'], 'reads': ['state channels'], 'writes': ['state updates', 'branch control']}, 'reply': {'triggers': ['branch:to:reply'], 'reads': ['state channels'], 'writes': ['state updates', 'branch control']}}
channels: {'__start__': 'input channel', 'branch:to:clean': 'EphemeralValue[Any]', 'branch:to:reply': 'EphemeralValue[Any]'}
edges: [('__start__', 'clean'), ('clean', 'reply'), ('reply', '__end__')]
~~~

## 观察结果

- 编译不是只把 Builder 原样返回；它建立可执行节点和运行时 channel 关系。
- CompiledStateGraph 是 Pregel 子类，后续执行由 Pregel 接手。

## 简化与边界

- actor/channel 记录是教学映射；节点触发 channel 名和普通节点触发 channel 类型参照真实编译代码，状态读写仍作了合并简化。
- 真实编译还处理 schema、分支、managed values、checkpointer、stream 和 cache。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
