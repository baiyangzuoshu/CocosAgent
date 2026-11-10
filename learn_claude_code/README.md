# Claude Code 源码学习

以 `engine/claude-code-analysis-main/src/` 为源码对象，按职责追踪 Claude Code CLI 的启动、交互、模型请求、工具执行和扩展系统。课程共 **34 课**，编号 `s00`–`s33`。

## 学习方式

1. 从本课的问题出发，先沿调用方找到入口，再跟到被调用模块。
2. 记录关键状态、消息类型和权限决策如何跨模块传递。
3. 用调用图、状态变化或消息流作为本课观察结果，再回到源码核对。
4. 每课标出源码路径、关键符号、范围边界；不把整套生产源码复制成教学实现。

## 课程

- [课程大纲](课程大纲.md)
- [第 00 课：源码快照边界与整体分层](s00_source_boundary/README.md)
- [第 01 课：CLI 轻量入口与快速分支](s01_cli_bootstrap/README.md)
- [第 02 课：Commander 参数解析与命令分发](s02_commander_routing/README.md)
- [第 03 课：命令执行前的初始化](s03_init_lifecycle/README.md)
- [第 04 课：配置、信任、认证与策略边界](s04_config_trust_auth_policy/README.md)
- [第 05 课：交互、Print、SDK 与 MCP 运行模式](s05_run_modes/README.md)
- [第 06 课：AppState 与状态订阅](s06_app_state_store/README.md)
- [第 07 课：Ink 终端界面树与渲染](s07_ink_rendering/README.md)
- [第 08 课：REPL 建立与首轮会话上下文](s08_repl_initial_context/README.md)
- [第 09 课：输入缓冲、消息队列与命令入口](s09_input_queue_commands/README.md)
- [第 10 课：系统提示词与用户上下文](s10_system_prompts_context/README.md)
- [第 11 课：消息、附件与终端展示](s11_message_attachment_rendering/README.md)
- [第 12 课：Transcript、会话恢复与历史](s12_transcript_resume_history/README.md)
- [第 13 课：`query()` 的边界、配置与依赖](s13_query_boundary_config_deps/README.md)
- [第 14 课：Query 主循环状态机](s14_query_loop_state_machine/README.md)
- [第 15 课：模型请求与流式 API](s15_model_request_streaming/README.md)
- [第 16 课：流式消息消费与 UI 事件](s16_stream_message_ui_events/README.md)
- [第 17 课：工具调用后的模型续跑](s17_tool_call_followup_loop/README.md)
- [第 18 课：错误、重试、回退与取消](s18_errors_retry_fallback_cancel/README.md)
- [第 19 课：Token 预算与上下文压缩](s19_token_budget_context_compaction/README.md)
- [第 20 课：工具注册、Schema 与发现](s20_tool_registry_schema_discovery/README.md)
- [第 21 课：权限模式与规则评估](s21_permission_modes_rule_evaluation/README.md)
- [第 22 课：`canUseTool`、用户确认与权限 UI](s22_can_use_tool_permission_ui/README.md)
- [第 23 课：工具执行生命周期与 Hooks](s23_tool_execution_lifecycle/README.md)
- [第 24 课：工具并发与流式执行](s24_tool_concurrency_streaming/README.md)
- [第 25 课：Bash 命令、安全校验与 Sandbox](s25_bash_safety_sandbox/README.md)
- [第 26 课：文件读取、写入、编辑与 Diff](s26_file_read_write_edit_diff/README.md)
- [第 27 课：Agent、子任务与团队协作](s27_agent_subtasks_team_collaboration/README.md)
- [第 28 课：MCP、插件、Skills、Hooks 与斜杠命令](s28_mcp_plugins_skills_hooks_commands/README.md)
- [第 29 课：端到端追踪与测试接缝](s29_end_to_end_trace_test_seams/README.md)
- [第 30 课：Print、SDK 与 Remote 会话的执行路径](s30_print_sdk_remote_execution_paths/README.md)
- [第 31 课：控制消息协议：权限请求、取消与中断](s31_control_message_permission_cancel_interrupt/README.md)
- [第 32 课：进程退出、信号与资源清理](s32_process_shutdown_cleanup/README.md)
- [第 33 课：RemoteIO 的传输选择与 CCR 会话事件](s33_remote_io_transport_event_lifecycle/README.md)

## 课程形式与证据边界

`engine/claude-code-analysis-main/` 当前展开为源码目录，没有 `package.json` 等项目构建入口；Git 将 `src.zip` 标记为已删除。因此首轮课程采用静态源码跟读：结果描述源码中可确认的调用、状态和分支，不把它表述为 CLI 的运行时验收。后续若补齐可运行环境，再为适合的专题增加独立观察程序。

每课沿用 `learn_3.8cocoscreator` 的组织原则：要理解的问题、源码入口、关键调用链、观察结果和范围说明；Claude Code 课的观察结果以源码证据和流程图为主。
