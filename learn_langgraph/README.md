# learn_langgraph

基于仓库中的 LangGraph Python 1.2.22 源码快照逐课学习图运行时。课程主线从构建图、编译图开始，继续追踪 Pregel 执行、流式输出、检查点和中断恢复。

## 学习方式

每课围绕一个问题，先读对应版本的源码，再运行一份精简的 Python 教学实现，观察状态与执行顺序。每课目录独立运行，后续课程逐步增加一个运行时机制。

30 课示例均使用 Python 标准库，逐课构建独立的教学模型，不导入 LangGraph 包，也不追求 API 兼容。节点使用确定性 Python 函数，不需要模型 API Key。

## 版本与环境

- LangGraph 源码快照：[AI/langgraph-main](../AI/langgraph-main/README.md)。
- Python 包版本：[libs/langgraph/pyproject.toml](../AI/langgraph-main/libs/langgraph/pyproject.toml)，版本 1.2.22，要求 Python 3.10 或更高。
- 第 1–30 课均使用 Python 标准库，无需安装 LangGraph 或配置模型 API Key。

## 课程入口

- [课程大纲：30 课](课程大纲.md)

### 阶段一：从图声明到编译

- [第 1 课：从 StateGraph 到可执行图](s01_minimal_stategraph/README.md)
- [第 2 课：Builder 怎样保存节点定义](s02_builder_node_registry/README.md)
- [第 3 课：节点怎样返回部分状态更新](s03_node_partial_updates/README.md)
- [第 4 课：State Schema 怎样定义共享状态](s04_state_schema_fields/README.md)
- [第 5 课：输入与输出 Schema 怎样限定图的边界](s05_input_output_schemas/README.md)
- [第 6 课：context_schema 怎样传递本次运行的上下文](s06_runtime_context/README.md)
- [第 7 课：Reducer 怎样合并多个更新](s07_reducer_merge/README.md)
- [第 8 课：START、普通边与 END 怎样确定执行顺序](s08_start_edges_end/README.md)
- [第 9 课：条件边怎样选择下一节点](s09_conditional_edges/README.md)
- [第 10 课：Send 与 Command 怎样表达动态路由](s10_send_command/README.md)
- [第 11 课：编译前会检查哪些图结构](s11_graph_validation/README.md)
- [第 12 课：compile 怎样把 StateGraph 降成 Pregel 图](s12_compile_to_pregel/README.md)

### 阶段二：Pregel 执行运行时

- [第 13 课：LastValue 与 EphemeralValue 分别保存什么](s13_value_channels/README.md)
- [第 14 课：BinaryOperatorAggregate 怎样应用 reducer](s14_binary_operator_aggregate/README.md)
- [第 15 课：Topic channel 怎样累积一轮中的多个更新](s15_topic_channel/README.md)
- [第 16 课：Plan 阶段怎样选出本轮要运行的节点](s16_pregel_plan_phase/README.md)
- [第 17 课：Runner 怎样启动并管理节点任务](s17_pregel_task_runner/README.md)
- [第 18 课：Update 阶段怎样提交节点写入](s18_update_barrier/README.md)
- [第 19 课：Superstep、循环和递归上限怎样决定运行边界](s19_supersteps_and_limits/README.md)

### 阶段三：调用与流式输出

- [第 20 课：invoke 与 ainvoke 怎样调用已编译图](s20_invoke_and_ainvoke/README.md)
- [第 21 课：RunnableConfig 怎样影响一次图运行](s21_runnable_config/README.md)
- [第 22 课：stream 与 astream 怎样逐步产出运行结果](s22_stream_lifecycle/README.md)
- [第 23 课：不同 stream mode 分别暴露哪些结果](s23_stream_modes/README.md)

### 阶段四：检查点与恢复

- [第 24 课：Checkpointer 接口负责保存和读取什么](s24_checkpointer_interface/README.md)
- [第 25 课：Checkpoint 如何记录状态与 channel 版本](s25_checkpoint_channel_versions/README.md)
- [第 26 课：Pending writes 怎样保留已完成节点的写入](s26_pending_writes/README.md)
- [第 27 课：thread_id 怎样关联运行与状态快照](s27_thread_id_snapshots/README.md)
- [第 28 课：如何查看历史状态、回放运行并更新状态](s28_history_replay_update_state/README.md)
- [第 29 课：interrupt 怎样暂停运行，恢复时又从哪里继续](s29_interrupt_resume/README.md)

### 阶段五：组合

- [第 30 课：子图怎样嵌入父图并保持各自的运行边界](s30_subgraph_boundary/README.md)

当前完成：第 1–30 课。
