# 第 0 课：仓库地图与系统边界

**目标：** 判断 CCGS 提供的是什么、由哪些部分组成，以及它和游戏本体、Cocos Creator 的关系。

## 本课要回答的问题

1. CCGS 是一个游戏，还是帮助 Claude Code 组织游戏开发的模板？
2. Agent、Skill、Hook、Rule、`project.yaml` 和 `studio-tests/` 分别解决什么问题？
3. 哪些说法能从目录结构直接核实，哪些还需要读实现或运行行为？

## 源码位置

- `engine/Claude-Code-Game-Studios/README.md`：用途、功能数量、引擎覆盖范围和启动方式。
- `engine/Claude-Code-Game-Studios/CLAUDE.md`：主上下文入口及导入的协作、编码规则。
- `engine/Claude-Code-Game-Studios/project.yaml`：框架版本和项目配置入口。
- `engine/Claude-Code-Game-Studios/.claude/settings.json`：权限配置和事件 Hook 注册。
- `engine/Claude-Code-Game-Studios/.claude/agents/`、`skills/`、`hooks/`、`rules/`：四类主要机制的定义。
- `engine/Claude-Code-Game-Studios/studio-tests/README.md`：框架自测的对象和覆盖方式。

## 观察步骤

在仓库根目录查看文件数量：

~~~sh
cd engine/Claude-Code-Game-Studios
rg --files --hidden .claude/agents -g '*.md' | wc -l
rg --files --hidden .claude/skills -g 'SKILL.md' | wc -l
rg --files --hidden .claude/hooks -g '*.sh' | wc -l
rg --files --hidden .claude/rules -g '*.md' | wc -l
~~~

然后对照 `README.md` 的 **What's Included**、**Getting Started**、**How It Works**，以及 `CLAUDE.md` 的 **Collaboration Protocol**。只读清单可以核实定义文件的数量；要判断定义是否正确执行，还要继续读对应的 Skill、Hook 或设置。

## 观察结果

本地快照应显示 49 个 Agent 定义、74 个 Skill 入口、18 个 Hook 脚本文件和 14 条 Rule。README 统计的是 15 个事件 Hook；额外脚本包含辅助脚本和诊断脚本，因此两个数字的计数对象不同。

| 目录或文件 | 主要职责 | 何时生效 |
| --- | --- | --- |
| `CLAUDE.md` | 项目级会话说明，并导入协作和编码资料 | Claude Code 从项目根目录启动会话时 |
| `.claude/agents/` | 专业角色的职责、领域和委派边界 | 任务需要委派给相应 Agent 时 |
| `.claude/skills/` | 可调用的工作步骤、输入、依赖和产物 | 用户或工作流调用相应 Skill 时 |
| `.claude/hooks/` + `settings.json` | 对工具或会话事件执行自动检查 | 配置的 Claude Code 事件发生时 |
| `.claude/rules/` | 按路径加载的编码指导 | 读取匹配路径的文件时作为上下文；不是强制校验 |
| `project.yaml` | 项目引擎、偏好和工作模式的配置源 | Skill 或 Hook 读取配置时 |
| `studio-tests/` | 检查 Agent/Skill 框架自身的结构和行为 | 运行 `/skill-test`、`/skill-improve` 时 |

因此，CCGS 是一套为 Claude Code 项目提供的工作流模板，模板本身不附带一个供玩家运行的游戏。它列出的引擎专用资料是 Godot、Unity 和 Unreal；本地 Cocos Creator 源码学习课程与它并非同一个产品或插件。

## 简化说明

- 本课只建立静态目录地图，不证明某个 Hook 在特定 Claude Code 版本中已经触发，也不证明 Agent 按描述完成了任务。
- 计数来自当前本地快照。框架版本可从 `project.yaml` 核对；上游更新后应重新计数。
- 课程不在这里运行游戏或改造 CCGS。后续章节会按主题读取具体实现和合同。

## 自测

不看上表，分别用一句话解释 Agent、Skill、Hook、Rule 的作用，并指出 `/skill-test` 测试的是 CCGS 还是游戏本身。回答能由本课列出的文件找到依据，即完成本课。
