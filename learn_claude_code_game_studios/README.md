# Claude Code Game Studios 学习课程

课程规划为 20 课，以仓库中的 Claude Code Game Studios（CCGS）快照为材料，逐层读懂它如何把游戏开发工作组织成一套可配置的 Claude Code 工作流。

## 学习目标

- 从目录和入口文件识别 CCGS 的组成部分。
- 分清 Agent、Skill、Hook、Rule、项目配置和工作流文档各自负责什么。
- 顺着一次游戏开发任务，追踪从 `/start` 到实现、验收和发布的协作链路。
- 判断质量门禁、测试证据和模板自测分别能证明什么。

本课程研究的是 Agent 工作流模板，不是游戏引擎，也不把 CCGS 当作 Cocos Creator 插件。它的引擎专用资料覆盖 Godot、Unity 和 Unreal；涉及 Creator 工程时，仍按仓库对应的 Creator 专题执行。

## 学习方式

已完成的课程沿用 `learn_3.8cocoscreator` 的结构：提出问题、定位源码或配置、运行实践、观察结果，并说明简化边界。实践在隔离的 CCGS 副本中进行，不把静态模拟说成 Claude Code 的运行结果。

课程材料以本地目录 `engine/Claude-Code-Game-Studios/` 为源码对照。该快照的 `project.yaml` 标记框架版本为 1.2.0；版本更新后，需重新核对章节中提到的路径和行为。源码项目由[上游仓库](https://github.com/Donchitos/Claude-Code-Game-Studios)单独维护；若本地没有这个目录，请先取得与课程版本相符的源码快照。

## 课程

- [20 课课程大纲](课程大纲.md)
- 已编写：[第 0 课：CCGS 是什么，又不是什么](s00_repository_map/README.md)
- 已编写：[第 1 课：会话入口与上下文装配](s01_session_context/README.md)
- 已编写：[第 2 课：Agent 角色与责任边界](s02_agent_roles/README.md)
- 已编写：[第 3 课：委派、并行任务与冲突升级](s03_delegation_and_conflicts/README.md)
- 已编写：[第 4 课：Skill 命令的结构](s04_skill_structure/README.md)
- 当前课程：[第 5 课：合同、参考资料与脚本](s05_contracts_references_scripts/README.md)

目前只编写第 0–5 课，第 5 课为当前课程。第 6–19 课先保留在大纲中，之后按顺序逐课学习、实践并编写，不提前生成完整课件。

开始实践前，按[实践环境说明](practice/README.md)创建隔离副本。课程中的交互命令在副本中运行，原始源码保持只读。

## 源码入口

- [CCGS 上游仓库](https://github.com/Donchitos/Claude-Code-Game-Studios)：功能说明和项目使用方式。
- [根级 CLAUDE.md](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/main/CLAUDE.md)：会话上下文、协作约定和文档导入。
- [project.yaml](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/main/project.yaml)：项目配置。
- [.claude/settings.json](https://github.com/Donchitos/Claude-Code-Game-Studios/blob/main/.claude/settings.json)：权限、Hooks 和状态栏配置。
- [studio-tests](https://github.com/Donchitos/Claude-Code-Game-Studios/tree/main/studio-tests)：框架自身的质量检查。
