# 第 4 课：Skill 命令的结构

**目标：** 从 CCGS 的 Skill 目录和 `SKILL.md` 追踪一个斜杠命令的入口信息、正文流程和参数线索。

完成本课后，你应该能：

1. 从 `.claude/skills/<名称>/SKILL.md` 找到一个 CCGS Skill 的完整定义。
2. 区分 frontmatter 中的描述、参数提示、调用控制、工具声明和模型字段。
3. 沿正文找出参数检查、配置预处理、阶段步骤、门禁和收尾。
4. 说明静态 Skill 文件能证明什么，以及哪些内容仍需当前 Claude Code 会话核验。

## 问题

课程索引把 CCGS 的 `/start`、`/dev-story`、`/team-combat` 等列为命令，但一次 Skill 的定义不止是索引中的名称和简介。调用时会看到什么提示、如何读取参数、在哪些条件下停止、会调用哪些工具，都要沿着具体 `SKILL.md` 阅读。

## 源码位置

| 文件 | 本课观察点 |
| --- | --- |
| `engine/Claude-Code-Game-Studios/.claude/docs/skills-reference.md` | 命令目录、分类和名称重叠提示 |
| `engine/Claude-Code-Game-Studios/.claude/skills/start/SKILL.md` | 入门型 Skill 的 frontmatter 和引导阶段 |
| `engine/Claude-Code-Game-Studios/.claude/skills/dev-story/SKILL.md` | 手动调用声明、Story 参数和实施流程 |
| `engine/Claude-Code-Game-Studios/.claude/skills/team-combat/SKILL.md` | 可选参数、配置注入、编排阶段和错误恢复 |

## 从索引找到定义文件

快照中的 `.claude/docs/skills-reference.md` 按阶段列出 74 个 slash command，说明其主要用途。它是导航目录，不是每个命令的完整流程定义。本地 `.claude/skills/` 中也有 74 个顶层 `SKILL.md` 文件；检查一项命令时，继续打开对应目录下的文件：

~~~text
.claude/skills/<skill-name>/SKILL.md
~~~

例如：

- `/start` → `.claude/skills/start/SKILL.md`
- `/dev-story` → `.claude/skills/dev-story/SKILL.md`
- `/team-combat` → `.claude/skills/team-combat/SKILL.md`

索引末尾还单独说明了 `/code-review` 与 Claude Code 自带 `/review` 的区别：同属“review”并不代表入口指向同一个 Skill。以上名称和数量来自本地 CCGS 1.2.0 快照；项目后续版本可能增删 Skill 或调整结构。

## 两层结构

### Frontmatter：调用前的说明和选项

`SKILL.md` 开头的 YAML frontmatter 通常包含以下字段：

| 字段 | 在 CCGS 文件中的用途 | 阅读时注意 |
| --- | --- | --- |
| `name` | Skill 的名称，如 `team-combat` | 应结合目录和当前 Claude Code 的命名规则核验 |
| `description` | 简要用途及适用情景 | 是入口说明，不是 Skill 的完整流程 |
| `argument-hint` | 提示预期参数，如 `[story-path]` | 是提示文本，不能当成参数校验器 |
| `user-invocable` | 用户是否能直接调用的声明 | 是否实际显示在菜单中仍以当前会话为准 |
| `disable-model-invocation` | 是否禁止模型自行触发的声明 | 不等于禁用用户手动调用；按当前 Claude Code 版本核对语义 |
| `allowed-tools` | Skill 声明要用的工具 | 配置声明不能证明权限一定生效或工具实际被调用 |
| `model` | Skill 文件中声明的模型档位 | 不代表该档位拥有更高领域决策权 |

`/start` 的 `argument-hint` 是 `[no arguments]`；`/team-combat` 则提示战斗特性描述和可选 review 参数。`/dev-story` 同时声明 `user-invocable: true` 和 `disable-model-invocation: true`。按 Claude Code 官方当前文档语义，这表示用户仍可手动调用，Claude 不会自行自动触发；`user-invocable: false` 则隐藏用户命令，但仍允许 Claude 按相关性调用。此语义依赖 Claude Code 版本，不能仅凭 CCGS 文件断言本地 CLI 已按当前定义运行。

当前 Claude Code 官方文档把项目 Skill 描述为 `.claude/skills/<skill-name>/SKILL.md`，并说明 `name`、`description` 和调用控制等 frontmatter 字段的语义；它也注明旧 `.claude/commands/` 命令文件继续兼容。CCGS 本地快照则用 `.claude/skills/` 保存 Skill 定义。CLI 语义会演进，遇到运行时行为问题应查当前[官方 Skills 文档](https://code.claude.com/docs/en/skills)，不把 1.2.0 快照中的字段说明外推成所有版本的保证。

### 正文：Skill 实际要求模型做什么

正文是 Markdown 指令。以 `team-combat` 为例，能看到：

1. 参数检查：没有特性描述时输出用法并停止。
2. 决策与预处理：读取项目配置、确定 `team.size`，并报告 active set。
3. 流程主体：按 Phase 1–6 推进设计、架构、实现、集成、验证和签收。
4. 失败恢复和结束信息：处理 BLOCKED，汇总状态并给出后续步骤。

这些段落是 Skill 指令所定义的期望流程，并不是一次会话已完成这些阶段的证据。实践时要把“写在文件里”和“会话真的执行了”分开记录。

某些 Skill 正文还会使用感叹号加反引号包裹 shell 命令的动态上下文注入格式：

~~~text
!`command`
~~~

例如 `team-combat` 在流程开始前调用 `yaml-helper.sh` 解析配置，再把输出放入上下文。静态阅读能定位这条命令，却不能代替观察它在某个项目中的实际输出。参数既可能通过文件里的 `$ARGUMENTS` 一类占位符表示，也可能像 `team-combat` 一样由正文规则解释用户输入；没找到占位符不等于命令没有参数。

## 实践一：盘点 Skill 文件

从仓库根目录运行：

~~~sh
python3 learn_claude_code_game_studios/practice/inspect_skill.py --list
~~~

脚本应列出 74 个 Skill 文件夹。接着分析两个结构不同的 Skill：

~~~sh
python3 learn_claude_code_game_studios/practice/inspect_skill.py start team-combat
~~~

它会显示路径、frontmatter 关键字段、目录名和 `name` 是否一致、一级至三级标题，以及参数占位符和动态命令注入行号。脚本不会执行注入的 shell 命令，也不会启动 Skill。

再检查实现型 Skill 的调用声明：

~~~sh
python3 learn_claude_code_game_studios/practice/inspect_skill.py dev-story
~~~

如果 CCGS 源码在其他目录，可以显式传入源码根目录：

~~~sh
python3 learn_claude_code_game_studios/practice/inspect_skill.py --source /path/to/Claude-Code-Game-Studios start team-combat
~~~

## 实践二：把声明映射到流程

根据脚本结果和原始文件，填完这张表。`SKILL.md` 的行号可用来复查证据：

| 问题 | `/start` | `/dev-story` | `/team-combat` |
| --- | --- | --- | --- |
| 文件路径 / `name` |  |  |  |
| 用户输入从哪里读 |  |  |  |
| 允许直接调用吗？文件声明是什么 |  |  |  |
| 有哪些工具或模型字段 |  |  |  |
| 正文第一步做什么 |  |  |  |
| 主要阶段 / 收尾在哪里 |  |  |  |

自查时应该能找到这些区别：`/start` 从项目状态和用户处境开始引导；`/dev-story` 用 Story 路径启动并先检查是否具备开工条件；`/team-combat` 先校验参数、解析配置，然后进入编排流程。三者都是 Skill，但其输入、门禁和副作用边界不同。

## 可选：核对当前会话菜单

在实践副本中启动 Claude Code，输入 `/` 查看当前会话列出的命令；不要仅凭静态 `skills-reference.md` 判断它们在当前 CLI 版本都可用。若要真正调用任何可能写项目文件的 Skill，先使用隔离副本，并按该 Skill 正文的确认要求操作。

## 本课结论

索引帮助发现命令，frontmatter 描述入口与配置，Markdown 正文规定流程；实际运行记录才能证明某次调用走到了哪里。检查一个 Skill 时，先定位 `SKILL.md`，再按“元数据 → 用户输入 → 预处理 → 阶段与门禁 → 输出与恢复”顺序阅读。

## 简化说明

- `inspect_skill.py` 只读取 frontmatter 的简单单行字段和 Markdown 标题，不是完整 YAML 解析器，也不验证字段是否受当前 Claude Code 版本支持。
- 脚本搜寻参数占位符和动态命令注入格式只是静态提示；Skill 正文也可能用自然语言处理参数，动态命令实际结果须在会话中观察。
- 官方文档说明的是当前 Claude Code 产品机制；本课中的 CCGS 文件事实限定于仓库内 1.2.0 快照。
- 本课不调用真实 Skill，因此没有运行时菜单、自动选择或阶段完成证据。

## 自测

1. `.claude/docs/skills-reference.md` 与 `.claude/skills/team-combat/SKILL.md` 分别能证明什么？
2. 为什么 `argument-hint` 不能证明 Skill 会校验参数？
3. `disable-model-invocation: true` 与 `user-invocable: true` 是否矛盾？请用 `/dev-story` 的声明说明。
4. `team-combat` 的 `!` 动态上下文行与其 Phase 流程分别扮演什么角色？
5. 哪些结论需要当前 Claude Code 会话才能核验？

答案要带上相应文件行号；对尚未运行的部分明确标为未核验。
