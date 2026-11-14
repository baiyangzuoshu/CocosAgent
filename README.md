# Cocos 与工程技术学习仓库

本仓库汇集源码学习课程、独立练习和对应的本地源码快照。当前工作树以课程资料为主；每条课程线的版本、依赖和运行方法以该目录的 `README.md` 为准。

## 课程入口

### Cocos 与图形

| 课程 | 内容 |
| --- | --- |
| [Cocos Creator 2.4.15](learn_2.4cocoscreator/README.md) | 以 Web 运行时为主，逐课追踪引擎机制并搭建精简实现。 |
| [Cocos Creator 3.8.7](learn_3.8cocoscreator/README.md) | 以 Web 运行时为主，按源码职责学习 3.8.7 引擎。 |
| [Cocos2d-x 1.x](learn_cocos2d-1x/README.md) | 基于仓库中的 1.x 源码快照学习。 |
| [Cocos2d-x 2.x](learn_cocos2d-2x/README.md) | 基于仓库中的 2.x 源码快照学习。 |
| [Cocos2d-x 3.x](learn_cocos2d-3x/README.md) | 基于仓库中的 3.x 源码快照学习。 |
| [Cocos2d-x 4.0](learn_cocos2d-4x/README.md) | 基于仓库中的 4.0 源码快照学习。 |
| [C 与 C++](learn_cpp/README.md) | 从 C 基础、现代 C++ 学到 Cocos2d-x 源码阅读。 |
| [OpenGL](learn_opengl/README.md) | 用独立练习学习现代 OpenGL，并与 Cocos 引擎渲染源码对照。 |

### 其他游戏引擎

| 课程 | 内容 |
| --- | --- |
| [Godot 4.8.0 beta](learn_godot/README.md) | 对照本地 Godot 源码快照，用 C++ 源码追踪和最小 Godot/GDScript 实验学习引擎架构。 |

### AI 与开发工具

| 课程 | 内容 |
| --- | --- |
| [LangChain 1.x Python](learn_langchain/README.md) | 对照 `AI/langchain-master` 快照逐课学习 LangChain 与 langchain-core 的架构、组合、检索和 Agent。 |
| [OpenAI 官方资料](learn_openai/README.md) | 按主题学习 OpenAI API、模型能力和开发工具。 |
| [Anthropic 官方资料](learn_anthropic/README.md) | 学习 Anthropic、Claude 产品与开发者平台资料。 |
| [LangGraph 1.2.22 Python](learn_langgraph/README.md) | 对照 AI/langgraph-main 快照学习图编译、Pregel 运行时、流式执行与持久化恢复。 |
| [Claude Code](learn_claude_code/README.md) | 根据仓库中的源码快照追踪 CLI 启动、请求、工具和扩展。 |
| [Claude Code Game Studios](learn_claude_code_game_studios/README.md) | 学习该仓库快照中的游戏开发工作流与配置。 |
| [DeepSeek Harness](learn-dsh/README.md) | 用 TypeScript 与 Deno 逐课搭建简化的 Harness 示例。 |

## 课程规划与研究资料

- [Cocos 引擎课程总纲](docs/cocos-engine-course-master-outline.md)：Creator 2.4.15、Creator 3.8.7 与 Cocos2d-x 1.x–4.x 的课程索引和规划。
- [Creator 2.x/3.x 源码研究计划](docs/source-study-plan.md)：版本专题和跨版本对照的研究方法。
- [Cocos2d-x 4.0 与 Creator 2.4.15 对照计划](docs/cocos2d-x-creator2x-source-study-plan.md)：跨引擎研究范围与证据口径。
- `docs/2.x/`、`docs/3.x/`、`docs/cocos2d-x/`：按引擎版本整理的专题资料。
- `docs/comparisons/`、`docs/diagrams/`：跨版本专题对照和流程图。
- `docs/agent-foundation/`：Creator 工具接入与 CLI 相关的研究记录；阅读时请区分历史设计资料和当前工作树中的实现。

## 本地源码

`engine/` 保存课程引用的源码快照，包括 Creator 2.4.15、Creator 3.8.7、Cocos2d-x 1.x–4.x、Godot 4.8.0 beta，以及 Claude Code 相关材料。以对应课程 README 标注的版本和路径为准；不要把某一快照中的结论直接推广到其他版本。

## 从这里开始

1. 选择上方课程，从该课程的 `README.md` 进入。
2. 按课程大纲顺序阅读；每课列出的源码路径、依赖和运行说明优先于仓库级概述。
3. 做跨版本比较时，分别确认两边的源码版本、平台和证据，再阅读对应比较资料。
