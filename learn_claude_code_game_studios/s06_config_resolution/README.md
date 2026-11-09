# 第 6 课：项目配置解析

**目标：** 从配置来源和优先级推导一个设置的有效值，并通过来源标记判断它为什么得到这个值。

完成本课后，你应该能：

1. 区分 `project.local.yaml`、`project.yaml`、旧式文本镜像、`modes.rigor` 派生值和默认值。
2. 读懂 `yaml-helper.sh resolve_config` 输出中的来源标签。
3. 用 `config-set.sh --dry-run` 预览配置写入会经过哪些检查，并在隔离副本内验证结果。

## 问题

`project.yaml` 里没有写某个设置，不等于这个设置没有值。CCGS 会按一条有顺序的解析链寻找可用值；有些值由 `modes.rigor` 推导，有些来自旧版文本文件，还有些只在具体 Skill 中才有默认处理。只读配置文件容易把“没写”“从别处继承”和“最终未设置”混为一谈。

Skill 不应各自重复推导。它可以在正文中运行 `yaml-helper.sh resolve_config`，让预处理输出在模型读取 Skill 前注入；Skill 随后直接使用解析值。每行括号里的来源标签是诊断配置的关键证据。

## 源码位置

| 文件 | 本课观察点 |
| --- | --- |
| `engine/Claude-Code-Game-Studios/project.yaml` | 项目级配置；当前快照只写了 schema 和框架元数据，没有 `modes:` 设置块 |
| `engine/Claude-Code-Game-Studios/.claude/docs/config-resolution.md` | 来源顺序、默认值、`rigor` 派生规则和例子 |
| `engine/Claude-Code-Game-Studios/.claude/hooks/yaml-helper.sh` | `resolve_config`、枚举验证和设置来源选择的实际实现 |
| `engine/Claude-Code-Game-Studios/.claude/scripts/config-set.sh` | 配置写入前的校验、覆盖提示和 `--dry-run` 预览 |
| `engine/Claude-Code-Game-Studios/.claude/skills/` 下调用解析器的 Skill | 正文中的预处理命令，以及对应的 `allowed-tools` 授权 |

## 解析链

对通常的设置，解析顺序是：

| 顺序 | 来源 | 适用范围 |
| --- | --- | --- |
| 1 | `project.local.yaml` | 仅 `/settings --local` 白名单中的键；这是个人覆盖 |
| 2 | `project.yaml` | 项目级设置 |
| 3 | 旧式文本镜像 | `modes.review_mode` 读 `production/review-mode.txt`；`project.stage` 读 `production/stage.txt` |
| 4 | `modes.rigor` 派生 | `workflow`、文档密度、QA、Story 粒度、审核模式和团队规模 |
| 5 | 文档化默认值 | 仅在前面的来源都没有有效值时使用 |

本快照的枚举值会先经过验证。无效值不会成为最终配置；解析链继续向后查找，并把拒绝原因放到 `notes:` 中。`project.local.yaml` 也有作用域白名单：手工放进去但不允许本地覆盖的键会被报告并忽略。

`modes.rigor` 默认是 `minimal`。它只为没有显式值的六个设置提供派生值：例如 `minimal` 会给出 `workflow=minimal`、`qa.level=minimal`、`review_mode=solo`；`full` 会给出 `workflow=full`、`qa.level=full`、`review_mode=full`。显式配置优先于派生值，所以把 `rigor` 设为 `full` 后，仍可在 `project.yaml` 单独固定 `qa.level: minimal`。第 7 课再细看档位对整套工作流的影响。

有两个边界值得留意：`testing.strict.*` 没有统一的中央默认值，未设置时由各 Skill 自己决定；`engine` 只从 `project.yaml` 读取，若缺失，解析器会说明应回退到 `.claude/docs/technical-preferences.md`。

## 本地快照的观察结果

在本地 CCGS 1.2.0 快照中，`project.local.yaml` 和两个旧式文本镜像都不存在。运行解析器得到：

~~~text
rigor: minimal (default)
review_mode: solo (rigor:minimal)
workflow: minimal (rigor:minimal)
docs.density: terse (rigor:minimal)
story_granularity: coarse (rigor:minimal)
qa.level: minimal (rigor:minimal)
team.size: individual (rigor:minimal)
project.stage: not set (unset)
engine: unset (fall back to .claude/docs/technical-preferences.md)
~~~

这组结果说明 `project.yaml` 没有这些键时，`rigor` 的默认值仍会派生六项设置；阶段没有镜像或配置时保持未设置；引擎字段缺失时也不会由解析器直接猜一个引擎。它没有证明某个 Skill 的后续回退文本已经被读取。

## 实践一：运行只读解析器

先按[实践环境说明](../practice/README.md)创建隔离副本，然后从副本根目录运行：

~~~sh
cd learn_claude_code_game_studios/practice/workspace
bash .claude/hooks/yaml-helper.sh resolve_config --keys rigor,review_mode,workflow,docs.density,story_granularity,qa.level,team.size,project.stage,engine
~~~

将运行结果与源码中的 `project.yaml`、可选的 `project.local.yaml` 和两个旧式镜像文件对照。按以下模板记录其中三项：

| 设置 | 有效值 | 来源标签 | 源文件/规则是否存在 | 为什么这个来源胜出 |
| --- | --- | --- | --- | --- |
| `qa.level` |  |  |  |  |
| `review_mode` |  |  |  |  |
| `project.stage` |  |  |  |  |

输出行只有值和来源标签；它不会自动证明相关文件在某次 Claude Code 会话中被人工查看。

## 实践二：预览配置变更并观察来源变化

在同一个隔离副本中，先预览把 `modes.rigor` 改成 `full` 的检查结果：

~~~sh
bash .claude/scripts/config-set.sh modes.rigor full --dry-run
~~~

`--dry-run` 只输出检查行，不写配置。确认预览中的文件是副本里的 `project.yaml` 后，再在这个可丢弃副本中执行写入，并重新运行上一节的 `resolve_config` 命令：

~~~sh
bash .claude/scripts/config-set.sh modes.rigor full
bash .claude/hooks/yaml-helper.sh resolve_config --keys rigor,review_mode,workflow,docs.density,story_granularity,qa.level,team.size
~~~

此时预期六个派生设置的来源标为 `rigor:full`。接着先预览、再把项目级 `qa.level` 单独设为 `minimal`，重新解析：

~~~sh
bash .claude/scripts/config-set.sh qa.level minimal --dry-run
bash .claude/scripts/config-set.sh qa.level minimal
bash .claude/hooks/yaml-helper.sh resolve_config --keys workflow,docs.density,qa.level,story_granularity,review_mode,team.size
~~~

核对结果：`qa.level` 应显示 `minimal (project.yaml)`；其他未显式设置的前置项仍由 `rigor:full` 提供。这样能观察“项目级显式值高于派生值”，而不只是在文档里背顺序。

**不要在只读源码快照里执行不带 `--dry-run` 的命令。** 写入练习只在 `practice/workspace/` 中进行；如果该副本已经用于其他课程，先为本课准备新的隔离副本。

本地快照中分别运行了两条 `--dry-run`。`modes.rigor=full` 与 `qa.level=minimal` 都报告：`project.yaml` 存在、枚举合法、该键不能放进 local override、不是 reserved、已知的枚举键、无覆盖冲突，写入预览为 `edit added-block 29`。这只是预览结果，不是实际写入或完整的 Claude Code 会话验收。

## 本课结论

先用解析器读取有效值和来源，再按同一优先级检查其来源；不要仅凭 `project.yaml` 是否出现某个键判断最终行为。更改前可用 `config-set.sh --dry-run` 检查目标文件、枚举、local 白名单和覆盖关系；确认只在隔离副本里写入后，再复跑解析器验证值和 provenance 是否一起变化。

## 简化说明

- 本课展示的是本地 CCGS 快照中辅助脚本的真实输出，不是 Claude Code 已经启动 Skill 的运行记录。
- `resolve_config` 只能报告它实际读取的配置及文档化回退；它不替代各 Skill 对 `unset` 值的专属处理。
- `config-set.sh --dry-run` 预览检查行，不证明写入后的完整运行行为；本课没有修改源码快照中的 `project.yaml`。
- 本课只用 `rigor` 演示一类派生设置；档位如何改变工作流、QA 和团队编排将在第 7 课展开。

## 自测

1. `qa.level` 未出现在 `project.yaml`，为什么本快照仍能得到一个值？
2. 若 `modes.rigor` 是 `full`，而 `project.yaml` 明确写了 `qa.level: minimal`，哪个值胜出，来源标签应是什么？
3. `modes.review_mode` 和 `project.stage` 各自会检查哪个旧式文本镜像？
4. `project.local.yaml` 中手工写入的任意键都会生效吗？如何检查？
5. `config-set.sh --dry-run` 输出 `edit added-block` 能证明哪些事，又不能证明什么？

每项答案都应能指向刚运行的命令结果或 `.claude/docs/config-resolution.md` / `yaml-helper.sh` 中的实现。未运行的写入步骤应标为未执行。
