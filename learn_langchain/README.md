# LangChain 1.x Python 源码学习

以仓库中的 `AI/langchain-master/` 源码快照为依据，沿着 `langchain-core` 的基础抽象、`langchain` 的高层 Agent API 和 provider 集成逐课学习。每课聚焦一个源码问题，用精简的 Python 示例呈现调用链和可观察结果。

课程共 30 节：第 0–26 课为 27 节主课，另有 A1–A3 三节 `langchain-classic` 历史附篇。

## 课程范围

- 主线：Python `langchain` 1.x 与 `langchain-core`。
- 历史附篇：`langchain-classic` 中的链、Memory 和迁移边界。
- 后续边界：`AI/langgraph-main/` 是独立源码项目；本课程在 Agent 组装处追踪 LangGraph 调用边界，不展开其运行时实现。
- 不覆盖：逐一讲解全部 provider、向量数据库和外部服务集成。

## 版本依据

课程按本地快照的包元数据固定版本：

| 包 | 快照版本 | 源码目录 |
| --- | --- | --- |
| `langchain` | 1.5.0 | `AI/langchain-master/libs/langchain_v1/` |
| `langchain-core` | 1.8.1 | `AI/langchain-master/libs/core/` |
| `langchain-classic` | 1.0.8 | `AI/langchain-master/libs/langchain/` |

以上包的元数据要求 Python 3.11 或更新版本。课程示例尽量只使用 Python 标准库和确定性假实现，不要求模型密钥或网络服务；外部 provider 只在单独标出的可选观察中出现。

## 学习方式

1. 按编号阅读一课，先确定它回答的问题。
2. 沿课内列出的源码路径查看关键类型、方法和调用方。
3. 运行该课独立目录中的精简示例，观察输入、调用过程和输出。
4. 对照简化说明，区分课程模型与真实源码中的异步、并发、序列化和 provider 细节。

每课目录保存自己的可运行示例；代码保留当前主题的职责和关键调用关系，不以完整复刻 LangChain 为目标。Python 课程示例使用 `python3 src/main.py` 运行，不会自动安装依赖。

## 课程入口

- [课程大纲](课程大纲.md)：课程阶段、课次和源码索引。
- [第 0 课：源码包地图](s00_source_map/README.md)：从包元数据确认版本、Python 要求和源码分层。

### Runnable 组合与执行

- [第 1 课：Runnable 协议与单次调用](s01_runnable_invoke/README.md)
- [第 2 课：RunnableSequence 顺序组合](s02_sequence_composition/README.md)
- [第 3 课：并行分支与条件路由](s03_parallel_routing/README.md)
- [第 4 课：RunnableConfig 与配置传递](s04_config_propagation/README.md)
- [第 5 课：Batch 与异步入口](s05_batch_async/README.md)
- [第 6 课：流式输出与 Chunk 合并](s06_streaming_chunks/README.md)
- [第 7 课：Retry、Fallback 与失败传播](s07_retry_fallback/README.md)

### Prompt、消息与模型

- [第 8 课：PromptTemplate 与 PromptValue](s08_prompt_template/README.md)
- [第 9 课：ChatPromptTemplate 与消息拼装](s09_chat_prompt_messages/README.md)
- [第 10 课：消息类型与多模态内容块](s10_message_content_blocks/README.md)
- [第 11 课：BaseChatModel 调用生命周期](s11_chat_model_lifecycle/README.md)
- [第 12 课：init_chat_model 与 Provider 解析](s12_model_provider_factory/README.md)
- [第 13 课：Provider 适配器与 Core 协议](s13_provider_adapter/README.md)

### Tools、输出与观测

- [第 14 课：Tool 定义、参数 Schema 与调用](s14_tool_schema/README.md)
- [第 15 课：Tool Call 与 ToolMessage 往返](s15_tool_call_roundtrip/README.md)
- [第 16 课：输出解析与结构化结果](s16_structured_output/README.md)
- [第 17 课：Callback 生命周期与 Tracing](s17_callbacks_tracing/README.md)

### 文档检索与 RAG

- [第 18 课：Document 与 Loader](s18_document_loader/README.md)
- [第 19 课：文本切分与 Chunk Metadata](s19_text_splitting/README.md)
- [第 20 课：Embedding、VectorStore 与 Retriever](s20_embeddings_vectorstore/README.md)
- [第 21 课：Runnable 组合成最小 RAG](s21_rag_composition/README.md)

### LangChain Agent

- [第 22 课：create_agent 工厂与执行图](s22_agent_factory/README.md)
- [第 23 课：Agent 工具循环与状态消息](s23_agent_tool_loop/README.md)
- [第 24 课：Agent Middleware 调用包装](s24_agent_middleware/README.md)
- [第 25 课：结构化输出与人工介入边界](s25_agent_human_review/README.md)
- [第 26 课：MCP Adapter 与外部工具](s26_mcp_adapter/README.md)

### 历史附篇：langchain-classic

- [附篇 A1：LLMChain 与 SequentialChain](a1_classic_chains/README.md)
- [附篇 A2：Conversation Memory 与历史状态](a2_conversation_memory/README.md)
- [附篇 A3：RetrievalQA 到 Runnable RAG](a3_retrieval_qa_migration/README.md)

## 第 0 课运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s00_source_map/src/main.py
~~~
