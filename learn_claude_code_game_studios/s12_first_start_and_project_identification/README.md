# 第 12 课：首次启动与项目识别

**目标：** 根据项目是否全新、已有引擎和现存文件，选对 CCGS 的入门 Skill；看清诊断和引导各自会不会写文件。

完成本课后，你应该能：

1. 区分 `/help`、`/project-stage-detect`、`/start` 与 `/setup-engine` 的用途。
2. 解释 `/start` 如何结合磁盘事实与用户回答决定下一步。
3. 追踪阶段检测中的配置覆盖、文件证据、工作流档位和置信度。
4. 在运行可能写配置或报告的 Skill 前，确认它的授权步骤和隔离位置。

## 问题

新用户、已有设计文件的项目、已经有代码但未配置引擎的工程，需要的入口并不相同。把 `/help` 当全量审计会漏掉内容质量判断；把 `/project-stage-detect` 当作只看文件名的确定性程序会忽略工作流档位；把 `/start` 当作无副作用的欢迎页又会漏掉它可保存的项目设置。

## 源码位置

| 文件 | 本课观察点 |
| --- | --- |
| `.claude/skills/help/SKILL.md` | 读取当前阶段/档位、工作流目录和工件检查，给一个下一步；声明只读 |
| `.claude/skills/project-stage-detect/SKILL.md` | 扫描工件、阶段判定、档位相关缺口、置信度及报告写入确认 |
| `.claude/skills/start/SKILL.md` | 读取项目事实，询问 A–D 起点，给出引导路径并在同意后保存设置 |
| `.claude/skills/setup-engine/SKILL.md`、`references/3-version.md` | 选择和验证引擎版本、探测本机安装、配置工程与版本参考 |
| `.claude/scripts/project-state.sh` | `/start` 使用的项目事实读取器及其字段来源 |
| `.claude/scripts/artifact-check.sh`、`.claude/docs/workflow-catalog.yaml` | `/help` 和阶段检测使用的工件存在性/路径完成状态 |
| `.claude/docs/config-resolution.md` | 项目配置与 `project.local.yaml` 的可覆盖字段范围 |
| `.claude/docs/templates/project-stage-report.md` | 阶段分析报告的字段结构 |

## 四个入口各自解决什么问题？

| Skill | 核心问题 | 主要输入 | 写入边界 | 适合何时用 |
| --- | --- | --- | --- | --- |
| `/help` | “我下一步做什么？” | 已解析的 workflow/stage、目录步骤、工件检查和 session 线索 | 声明只读；工具列表没有 `Write` / `Edit` | 已在项目里，需要一个近期下一步 |
| `/project-stage-detect` | “项目实际到了哪里，档位下还缺什么？” | 配置、`artifact-check.sh` 结果和内容/数量判断 | `Write` 工具可用；先呈现发现并询问，获准后才写完整报告 | 接手既有项目，需要较完整的现状与缺口分析 |
| `/start` | “我从哪里开始，怎样接入工作流？” | `project-state.sh` 的项目事实，加上用户对起点 A–D 的回答 | 只在明确同意后保存 `project.stage`、`modes.rigor` 和 `modes.automation`；然后移交，不运行下一 Skill | 初次使用、重新定位，或把已有工程接入流程 |
| `/setup-engine` | “项目用什么引擎/版本，并如何配置？” | 用户选择/确认的引擎版本、本机安装探测、项目结构 | 有 `Write`、`Edit`、`WebSearch` 等能力，会配置项目文件和引擎资料 | 引擎未配置、要刷新参考资料或要升级版本 |

`/help` 的快速建议和 `/project-stage-detect` 的完整诊断不是同一工作。`/start` 的 A–D 是用户的起点描述；遇到与磁盘事实冲突时，它会指出冲突并再次确认。已有工程且引擎缺失、内容还不超过概念阶段时，`/start` 会优先建议 `/setup-engine`；更成熟或有代码的现有项目会进入 `/project-stage-detect`。

若已有引擎且 concept/brief 已存在，`/start` 把用户视为 returning user：不重走新手提问，而是说明已发现的状态并建议 `/help`。但当前 `start/SKILL.md` 的 Phase 6 有一处顺序冲突：通用规则要求在 Phase 3 选了 `/brainstorm` 时把它放在 `/setup-engine` 前，标准 Concept 列表却把 `/setup-engine` 放在 `/brainstorm` 前；`minimal` 列表也从 `/setup-engine` 开始。本课记录这个源文档差异，不假装其中一个次序已经由运行观察确认。

`project-state.sh` 还声明按 `project.local.yaml` → `project.yaml` → legacy Engine 行读取 `engine.name`；但 `config-resolution.md` 把本地文件限制为 12 个允许键，其中不含 `engine.name`。如果某个工程手工把 `engine.name` 写入 `project.local.yaml`，此辅助器与通用配置解析可能给出不同结果；应回查两边合同，不要只凭一行状态输出定案。

## `/project-stage-detect`：文件证据不是最终判决

它先用一次 `artifact-check.sh` 汇总目录中可确定的工件状态，再分析该脚本不能回答的内容完整度、数量和阶段判断。配置中的 `project.stage`（旧项目可从 `production/stage.txt` 读取）是已记录阶段；Skill 仍要求运行文件启发式并进行比较。若“配置阶段”和“观察阶段”不一致，应报告分歧，置信度为 `CONCERNS`，不能只复述配置值。

配置的 `workflow` 档位决定缺少哪些材料才算缺口。`minimal` 下不运行 `/gate-check`，配置 stage 不会按阶段门推进；Skill 将它与观察阶段的滞后视为该档位的预期行为，而不是一般的阶段冲突：

- `full` 会列出较完整的设计/架构缺失项。
- `standard` 只把规定的核心材料标成缺口，不将所有可选文档都当阻塞项。
- `minimal` 以简短 brief 和引擎作为正常起点；不应因为缺少 GDD、艺术圣经、ADR 或冲刺计划就报成缺口。

另一个边界是未解析的 code root：`source_files: unknown` 表示扫描基础不成立，不等于“0 个源码文件”或全新项目。输出的 Stage Confidence 区分 `PASS`、`CONCERNS`、`NOT ASSESSED` 和 `FAIL`；检查没跑不能冒充检查通过。生成完整 `production/project-stage-report.md` 之前，Skill 要先给出摘要并请求许可。

## `/start`：引导流程会写设置，但不替用户启动下一步

`/start` 首先调用只读的 `project-state.sh`，取得 engine、code root、源码数、概念文档、GDD/ADR、stage 和仓库 remote 等事实；然后询问用户从 A（没想法）、B（模糊想法）、C（明确概念）还是 D（已有工作）开始。它把用户回答与磁盘事实交叉检查，不把 `project-state.sh` 输出的 `phase_inferred` 当作最终结论。该 helper 不提供 rigor/automation；`/start` 会另外读取 `project.yaml`，保留已经设置的值或询问缺失值。

之后它展示推荐 stage 和 rigor，并询问是否保存。明确同意才通过 `set-stage.sh` / `config-set.sh` 写入 stage、rigor，以及在未配置时写入 automation；拒绝或跳过则不保存。引擎不是 `/start` 替用户决定的设置，仍由 `/setup-engine` 处理。最后 `/start` 只给出完整路径并移交第一步，不能因为用户同意“开始”就替用户运行 `/brainstorm` 或其他下一项 Skill。

`/setup-engine` 不只是写一行 engine 名：它会核对选择的版本与本机探测结果，更新主配置及相关说明/导入；版本未给出时按其流程查证，不允许凭猜测填版本。运行或升级前要意识到它可能更改项目文件。课程中只读其合同，不在真实源码快照里启动它。

## 实践一：静态追踪四个入口的权限与交接点

从仓库根目录运行：

~~~sh
python3 learn_claude_code_game_studios/practice/trace_onboarding_skills.py
~~~

脚本读取四个 Skill 的 frontmatter、对应参考文件和关键行为标记。当前快照应看到 `/help` 没有写工具，`/project-stage-detect` 有 `Write` 但包含报告审批步骤，`/start` 通过受限 Bash helper 保存设置，`/setup-engine` 有配置/检索能力；它还会提示 `/start` 内部存在的 Concept 路径顺序差异。若脚本报告缺少信号，打开对应 `SKILL.md` 核对；不要把静态工具许可当作一次运行记录。

手工完成下表：

| 起点/需求 | 应选入口 | 下一步如何确定 | 会不会马上写文件 |
| --- | --- | --- | --- |
| 新用户还没想好游戏 |  |  |  |
| 已有代码，想知道整体缺口 |  |  |  |
| 已在开发，只问接下来做什么 |  |  |  |
| 项目没配置引擎或准备换版本 |  |  |  |

## 实践二：核对阶段信号与档位影响

~~~sh
rg -n 'workflow|project\.stage|artifact-check\.sh|Always run the heuristics|Stage Confidence|NOT ASSESSED|Request Approval Before Writing' engine/Claude-Code-Game-Studios/.claude/skills/project-stage-detect/SKILL.md
rg -n 'phase_inferred|Ignore `phase_inferred`|project-state\.sh|explicit yes|Phase 7: Hand off' engine/Claude-Code-Game-Studios/.claude/skills/start/SKILL.md
rg -n 'This skill is read-only|workflow-catalog\.yaml|artifact-check\.sh|Step 4m|minimal' engine/Claude-Code-Game-Studios/.claude/skills/help/SKILL.md
~~~

试着回答：一个项目的配置 stage 是 `Release`，但观测到的源码、ADR 和 epics 只支持 `Pre-Production`，报告应该怎么写？在 `minimal` 下缺少 GDD 是否应当算缺口？code root 未解析时，源码数应写 0 还是 `unknown`？完整报告可以何时写入？

如需观察真实会话，只在 `practice/create_sandbox.py` 创建的隔离副本中启动 Claude Code，再运行 `/help`、`/project-stage-detect` 或 `/start`。`/start` 保存选择时回答“不要保存”即可验证无写入分支；阶段报告询问前不要直接批准写入。本课没有在 CCGS 源码快照中调用这些 Skills。

## 本课结论

先辨别用户要的是快速下一步、完整阶段诊断、新用户引导，还是引擎配置。然后检查 Skill 使用的事实来源和档位语义，最后确认它的写入点及同意要求。阶段检测是基于证据的判断，不是文件计数器；引导流程负责解释和移交，不代表可以自动执行用户尚未启动的下一步。

## 简化说明

- `trace_onboarding_skills.py` 静态检查 frontmatter 和正文标记；不会执行 `/help`、`/start`、`/project-stage-detect`、`/setup-engine` 或它们调用的 helper。
- `artifact-check.sh` 的 `PRESENT` 证明匹配到工件，不证明内容质量；`NO_CHECK` 也不等于完成。
- 阶段启发式与 gap 规则来自 CCGS 1.2.0 本地快照。改版本后应重新核对 `workflow-catalog.yaml` 和各 Skill。
- 真实项目状态依赖实际工程文件和用户补充信息。本课没有接入或扫描单独的游戏工程。

## 自测

1. 为什么 `/help` 的“下一步建议”不能替代 `/project-stage-detect` 的全量缺口分析？
2. `/project-stage-detect` 遇到配置 stage 与观察 stage 不一致时，应如何呈现？
3. `/start` 读到 `engine` 未配置时，是否会直接替用户决定 Godot/Unity/Unreal？
4. `/start` 和 `/project-stage-detect` 分别在哪些时点会写入文件？
5. 在 `workflow: minimal` 下，为什么不能把缺少 GDD 或 sprint plan 标成项目阻塞？
6. 为什么 `/start` 的 Concept 路径顺序需要回到原文核对，而不能只抄一段生成成“确定行为”？
7. 如果 `project.local.yaml` 手工写入 `engine.name`，为什么要比较 `project-state.sh` 与 `config-resolution.md` 的规则？
