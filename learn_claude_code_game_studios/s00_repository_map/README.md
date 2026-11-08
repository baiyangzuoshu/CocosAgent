# 第 0 课：CCGS 是什么，又不是什么

**目标：** 从仓库中的文件和配置出发，判断 Claude Code Game Studios（CCGS）的职责边界，并能解释它怎样组织一次游戏开发任务。

完成本课后，你应该能回答：

1. 这个仓库交付的是游戏、引擎，还是开发工作流？
2. Agent、Skill、Hook、Rule 和 `project.yaml` 各解决哪一类问题？
3. 静态文件能证明什么，哪些结论还需要实际运行才能成立？

## 源码位置

| 文件 | 本课关注点 |
| --- | --- |
| `engine/Claude-Code-Game-Studios/README.md` | Why This Exists、What's Included、Getting Started、How It Works |
| `engine/Claude-Code-Game-Studios/CLAUDE.md` | 项目说明入口、引擎选择、协作协议和按需上下文 |
| `engine/Claude-Code-Game-Studios/project.yaml` | 框架版本和模板当前配置状态 |
| `engine/Claude-Code-Game-Studios/.claude/settings.json` | 工具权限、事件 Hook 注册和状态栏入口 |
| `engine/Claude-Code-Game-Studios/.claude/agents/` | 专业角色定义 |
| `engine/Claude-Code-Game-Studios/.claude/skills/` | 可调用工作流定义 |
| `engine/Claude-Code-Game-Studios/.claude/hooks/` | 事件处理脚本和辅助脚本 |
| `engine/Claude-Code-Game-Studios/.claude/rules/` | 路径范围内的规则说明 |
| `engine/Claude-Code-Game-Studios/studio-tests/README.md` | CCGS 自身的测试对象和入口 |

## 观察一：先辨认交付物

打开 `README.md`，读 **Why This Exists**、**Does it produce games, or documents?** 和 **Project Structure**。再看 `src/` 和 `production/`：当前快照的 `src/` 只有说明文件和 `.gitkeep`，没有随模板附带一款完整游戏。

据此先写下一个暂定判断：CCGS 是给 Claude Code 项目使用的游戏开发工作流模板；它要帮助用户制作游戏，但模板本身不是游戏引擎或游戏成品。

继续从 `CLAUDE.md` 的 Technology Stack 核对目标引擎：模板为 Godot 4、Unity 和 Unreal Engine 5 提供专用角色和参考资料。列表没有 Cocos Creator，因此不能把这些规则当作 Creator 插件或 Creator API 的依据。

## 实践一：盘点真实快照

从仓库根目录运行课程自带的盘点程序：

~~~sh
python3 learn_claude_code_game_studios/practice/audit_snapshot.py
~~~

程序实际读取 `project.yaml`、`settings.json` 和各目录，不使用写死的计数。当前 1.2.0 快照应显示 49 个 Agent 定义、74 个 Skill 入口、15 个已注册 Hook 命令、18 个 Hook 目录下的 shell 文件和 14 条 Rule。运行输出是当前磁盘清单的证据；它不能证明任何 Agent 或 Hook 在会话中成功运行。

如要盘点其他位置的版本，把源码目录作为参数：

~~~sh
python3 learn_claude_code_game_studios/practice/audit_snapshot.py /path/to/Claude-Code-Game-Studios
~~~

## 观察二：把机制和职责对上

| 机制 | 去哪里看 | 它回答的问题 | 何时参与工作 |
| --- | --- | --- | --- |
| `CLAUDE.md` | 仓库根目录 | 当前项目有哪些重要约定？ | Claude Code 在项目根目录启动会话时 |
| Agent | `.claude/agents/` | 这项工作由什么领域角色负责？ | 被 Skill 或协调流程委派时 |
| Skill | `.claude/skills/` | 这类任务按什么步骤完成？ | 用户或 Agent 调用对应命令时 |
| Hook | `.claude/settings.json` 与 `.claude/hooks/` | 某个工具或会话事件发生时要自动运行什么动作？ | 配置的事件触发时 |
| Rule | `.claude/rules/` | 处理某类路径时应遵守什么指导？ | 读取路径匹配的文件后作为上下文加载 |
| 项目配置 | `project.yaml` | 当前团队采用哪些引擎、偏好和流程设置？ | Skill 或 Hook 解析设置时 |
| Studio Tests | `studio-tests/` | 这套 Agent/Skill 框架自身是否符合约定？ | 运行 `/skill-test` 或 `/skill-improve` 时 |

这些机制各司其职：Skill 组织步骤，Agent 承担领域角色，Hook 绑定自动事件，Rule 提供匹配路径的上下文，配置决定工作方式；Studio Tests 检查框架自身。它们组合起来支持游戏开发，但不能互相替代。

## 观察四：区分定义和运行证据

把你看到的结论分成三类：

| 证据 | 能证明 | 不能单独证明 |
| --- | --- | --- |
| README 的功能说明 | 项目如何描述自己的目标和能力 | 每项能力已在当前 Claude Code 版本实际生效 |
| Agent、Skill、Rule 文件 | 对应定义存在，且写了哪些职责或步骤 | Agent 一定会被选中、模型一定遵从 Rule |
| `settings.json` 与 Hook 脚本 | 哪些事件注册了脚本，以及脚本静态逻辑 | 某次会话确实触发了脚本，或目标游戏通过了检查 |
| `studio-tests/` 规范 | 框架计划怎样检查 Agent/Skill | 游戏本身已通过测试 |
| 游戏运行和保留的 QA 证据 | 对应构建在观察时表现出的行为 | 所有设备、版本和场景均无问题 |

这一区分是后续课程的读源码方法：先找定义，再追引用和触发条件；需要运行时结论时，单独取得运行证据。

## 本课结论

当前快照标记为 CCGS 1.2.0。它是一套面向 Claude Code 的游戏开发流程模板，包含角色、工作流、事件检查、路径规则、引擎资料和框架自测。它不自带一款游戏，也不覆盖 Cocos Creator 的引擎知识。静态阅读可以建立结构图，不能替代对真实会话或游戏构建的观察。

## 实践二：在副本中启动 CCGS

按[实践环境说明](../practice/README.md)创建副本，然后从副本根目录启动 `claude`。观察 SessionStart 输出，再运行 `/help`，记下它建议的下一步。退出后确认实验只发生在 `practice/workspace/`，没有修改 `engine/Claude-Code-Game-Studios/`。

## 简化说明

- 盘点数量来自程序实际读取的本地快照；换版本后重新执行，不把 1.2.0 计数当作永久值。
- SessionStart 和 `/help` 的结果来自学习者自己的 Claude Code 会话；不同配置和版本可能产生不同输出，应记录实际观察。
- 后续课程逐项拆解表格中的机制；本课不展开 74 个 Skill 或 49 个 Agent 的完整定义。

## 自测

不看上面的表，完成下面四项：

1. 用一句话说明 CCGS 的交付物，并说明它与游戏成品的关系。
2. 为“新建一条带规则校验的 Story”分别选择 Skill、Agent、Hook 或 Rule 负责的部分。
3. 解释为什么 18 个 `.sh` 文件不等于 18 个已注册 Hook 命令。
4. 说明 `/skill-test` 的结果能否证明某款游戏已运行成功，并指出还需要什么证据。

能用仓库中的文件路径为每个回答找到依据，即完成本课。
