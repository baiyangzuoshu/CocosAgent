# Claude Code 源码学习

以 `engine/claude-code-analysis-main/src/` 为源码对象，按职责追踪 Claude Code CLI 的启动、交互、模型请求、工具执行和扩展系统。课程暂定 **30 课**，编号 `s00`–`s29`。

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

## 课程形式与证据边界

`engine/claude-code-analysis-main/` 当前展开为源码目录，没有 `package.json` 等项目构建入口；Git 将 `src.zip` 标记为已删除。因此首轮课程采用静态源码跟读：结果描述源码中可确认的调用、状态和分支，不把它表述为 CLI 的运行时验收。后续若补齐可运行环境，再为适合的专题增加独立观察程序。

每课沿用 `learn_3.8cocoscreator` 的组织原则：要理解的问题、源码入口、关键调用链、观察结果和范围说明；Claude Code 课的观察结果以源码证据和流程图为主。
