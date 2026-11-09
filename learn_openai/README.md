# learn_openai

OpenAI 官方资料逐课学习。主线从基础概念进入 API、模型能力、工具、Agents，再到上线和优化；以 OpenAI 官方文档为事实来源，版本和产品状态在对应课程中核对。

## 学习方式

每课围绕一个问题，包含：

1. 本课目标与前置知识。
2. 官方资料页面和需要看的部分。
3. 一个最小示例或观察练习。
4. 可以检查的结果。
5. 本课的简化点、限制和易混点。

大主题拆成多课；每次完成一个知识点，再进入下一课。代码主题默认使用 TypeScript 示例；概念主题不要求预先配置 API Key。

## 课程范围

核心路线以 OpenAI 开发者文档为主，覆盖模型、Responses API、多模态、工具、Agents、评估和生产实践。ChatGPT 与 Codex 的产品使用文档作为独立支线，按需要加入。

## 入口

- [课程总纲](课程大纲.md)
- [第 0 课：OpenAI 官网与文档地图](s00_official_docs_map/README.md)
- [第 1 课：产品、模型、API、SDK 与应用](s01_system_model_api_sdk_app/README.md)
- [第 2 课：生成式模型如何从输入生成输出](s02_text_generation_flow/README.md)
- [第 3 课：Token、上下文窗口与输入/输出长度](s03_tokens_context_window/README.md)
- [第 4 课：Prompt、指令和消息角色](s04_prompt_instructions_roles/README.md)
- [第 5 课：如何按任务选择模型](s05_model_selection/README.md)
- [第 6 课：Project、API Key 和身份验证](s06_projects_keys_authentication/README.md)
- [第 7 课：发出第一个 Responses API 请求](s07_first_responses_request/README.md)
- [第 8 课：Responses 请求与返回对象](s08_responses_request_response/README.md)
- [第 9 课：让模型按 Schema 返回结构化数据](s09_structured_outputs/README.md)
- [第 10 课：多轮对话怎样保留上下文](s10_conversation_state/README.md)
- [第 11 课：Streaming 与 Background Mode](s11_streaming_background/README.md)
- [第 12 课：请求失败、限流与 Request ID](s12_errors_rate_limits_request_ids/README.md)
- [第 13 课：模型怎样接收和理解图片](s13_image_inputs_vision/README.md)
- [第 14 课：把文件和 PDF 提供给模型](s14_file_inputs_pdf_file_search/README.md)
- [第 15 课：语音转文字与音频理解](s15_audio_transcription_understanding/README.md)
- [第 16 课：文字转语音、流式音频与实时语音对话](s16_tts_realtime_voice/README.md)
- [第 17 课：Embedding 与向量相似度](s17_embeddings_vector_similarity/README.md)
- [第 18 课：File Search、Vector Store 与 RAG](s18_file_search_vector_stores_rag/README.md)
- [第 19 课：图像生成的返回结构与视频 API 状态](s19_image_and_video_generation/README.md)
- [第 20 课：Function Calling 怎样从工具请求走到应用执行](s20_function_calling_loop/README.md)
- [第 21 课：OpenAI 内置工具和自定义函数怎样选择](s21_builtin_tools_vs_functions/README.md)
- [第 22 课：Web Search 怎样补充实时网页信息](s22_web_search/README.md)
- [第 23 课：Code Interpreter 适合哪些文件与计算任务](s23_code_interpreter/README.md)
- [第 24 课：Computer Use 怎样操作界面](s24_computer_use/README.md)
- [第 25 课：MCP 如何把外部工具接入模型工作流](s25_mcp_tools/README.md)
- [第 26 课：什么样的系统才需要 Agent？](s26_when_to_use_agents/README.md)
- [第 27 课：Responses API、Agents SDK、Agents API 和 ChatKit 如何选择？](s27_choose_agent_runtime/README.md)

## 进度

当前学习至第 27 课。课程顺序会根据理解情况调整；模型名称、价格、可用性和产品状态等易变内容以授课时核对的官方资料为准。
