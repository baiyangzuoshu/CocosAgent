# 第 8 课：Automation 模式与确认边界

**目标：** 读懂 `collaborative`、`guided`、`autonomous` 如何改变决策和写入前的确认，并识别所有模式仍需遵循的暂停条件。

完成本课后，你应该能：

1. 按实际设置值判断一项选择会询问、先建议后继续，还是自行决定并记日志。
2. 查出 `autonomous` 中哪些类别仍必须询问，以及哪些 Skill 不受 Automation 模式控制。
3. 解释“问题被跳过”为什么不等于授权，以及怎样从 Skill 正文验证它采用的模式规则。

## 问题

`automation` 控制工作如何继续：是否逐项等待确认、是否能对小决定直接推进，以及决策是否写入日志。它不等于 `workflow`（资料和 Gate 的要求），也不等于 review/team 配置（谁来审核）。更不能只看到 `autonomous` 就推断所有问题和写入都会跳过确认。

## 源码位置

| 文件 | 本课观察点 |
| --- | --- |
| `engine/Claude-Code-Game-Studios/.claude/docs/automation-modes.md` | 三种模式的交互约定、major/minor 分类、always-ask 类别、例外和决策日志 |
| `engine/Claude-Code-Game-Studios/.claude/hooks/yaml-helper.sh` | Automation 设置及 always-ask 列表的有效值读取 |
| `engine/Claude-Code-Game-Studios/.claude/scripts/config-set.sh` | 枚举校验和安全预览；练习脚本只对临时副本执行写入 |
| `engine/Claude-Code-Game-Studios/.claude/skills/dev-story/SKILL.md` | 一个普通开发 Skill 如何声明遵守 shared pattern |
| `engine/Claude-Code-Game-Studios/.claude/skills/start/SKILL.md` | 哪些入门问题在 Automation 模式下仍始终询问，以及选项保存时如何取得同意 |
| `engine/Claude-Code-Game-Studios/.claude/skills/gate-check/SKILL.md` | Gate 为什么始终保留人工确认和结果审阅 |

`automation-modes.md` 是 Skill 执行时的直接模式合同。`.claude/docs/effects-map.md` 是设置规范的维护参考；shared pattern 明确要求常规 Skill 运行时不加载那份大文件。

## 三种模式会怎样互动

| 场景 | `collaborative` | `guided` | `autonomous` |
| --- | --- | --- | --- |
| 多选项设计决定 | 每项都询问，给出选项及利弊 | major 仍询问，最多两项并给推荐；minor 说明建议后继续 | 选推荐项，不展示备选；记决策日志，除非命中 always-ask |
| 修改已有文件 | 展示完整草稿并等用户批准 | 简要展示改动，汇报后继续 | 直接写入，不做草稿审阅 |
| 新建文件 | 先询问写入 | 询问并等待回答 | 直接写入，除非属于 always-ask 类别 |
| 常规流程节点 | 逐节或逐步确认 | 小步骤可自动推进 | 自动推进并记录被省略的用户决策 |

`guided` 的 major 决定包括核心机制、互斥的架构方向、系统命名，以及会影响下游工作或导致大量返工的选择。排版、已批准方案内补充细节、下一步常规路由等通常是 minor。具体 Skill 应先分类，再按模式应用规则，不能只根据操作名称猜测。

## Autonomous 仍有哪些暂停点

默认 `modes.automation_always_ask` 为：

- `scope_changes`：移除功能、改变期限、拆分或合并 Epic、删验收标准。
- `file_deletions`：删除 Story、GDD、系统或测试文件。
- `schema_changes`：改 `project.yaml` 结构或修改模板、control manifest 等 schema。

项目可以从 `/settings` 配置其他已识别类别，如 `architecture_decisions`、`version_bumps`、`external_calls`。**被识别不代表默认启用**：只有出现在有效的 always-ask 列表中的类别，才会在 `autonomous` 中强制询问。应读取实际解析结果，不要把整张可配置类别表都当成当前规则。

`autonomous` 中跳过的决定会追加到 `production/session-logs/decision-log.md`：记录 Skill、决定点、考虑的选项、选择、理由和类别。日志是事后审阅线索；它不代替需要事先取得的确认。

Shared pattern 还列出始终按 `collaborative` 运作的例外 Skill：`hotfix`、`gate-check`、`day-one-patch` 和 `setup-engine`。例如 Gate 的目的就是让人审阅准备情况，`gate-check` 的 Skill 明确不受 automation 设置控制。

无论何种模式，若问题被关闭、跳过、没有选择或返回空值，都不能替用户作答、写文件或改设置。Skill 必须用普通文本重新说明等待的决定并停下来；CI/headless 环境无人能答时就报告阻塞原因。

## 模式与 `/start` 的具体关系

`/start` 是一个有自己明确规则的例子：它的 Skill 指定第 2、4、5 阶段的问题在任何 Automation 模式都要问。Phase 5 先让用户选择 Automation 模式；这个选择本身也是写入 `project.yaml` 的同意。后续 Phase 6 才按新保存的模式执行。由此可见，通用模式合同要结合调用它的 Skill 阅读，不能推断一个模式可以取消所有必问节点。

普通的 `/dev-story` 则明确声明遵循 shared pattern；在 `autonomous` 下常规选择会记录后继续，命中配置的 always-ask 类别时仍会询问。设置管理也有具体保护：默认 `schema_changes` 会让 `/settings` 即使在 autonomous 下仍确认 `project.yaml` 写入。

## 实践一：真实解析三种模式

在仓库根目录运行：

~~~sh
python3 learn_claude_code_game_studios/practice/compare_automation_modes.py
~~~

脚本只把模板中的 `project.yaml` 复制到自动清理的临时目录（不复制个人 `project.local.yaml`），先用 CCGS 自带 `config-set.sh --dry-run` 核对枚举，再写入三个模式并运行真实的 `yaml-helper.sh resolve_config`。不会修改源码快照或已有的 `practice/workspace/`。当前模板快照的输出应显示三种 `automation` 值分别来自临时 `project.yaml`，而默认 always-ask 列表仍是 `scope_changes, file_deletions, schema_changes`。

记录输出并回答：模式值变化时，always-ask 列表是否也跟着变化？输出能证明设置已解析到什么程度？它不能证明 Claude Code 已经在相应模式下执行过一次决定。

## 实践二：从 Skill 核对决策边界

从仓库根目录运行：

~~~sh
sed -n '35,130p' engine/Claude-Code-Game-Studios/.claude/docs/automation-modes.md
sed -n '170,225p' engine/Claude-Code-Game-Studios/.claude/docs/automation-modes.md
sed -n '25,34p' engine/Claude-Code-Game-Studios/.claude/skills/start/SKILL.md
sed -n '140,156p' engine/Claude-Code-Game-Studios/.claude/skills/start/SKILL.md
rg -n -C 2 'automation-modes|automation_always_ask' engine/Claude-Code-Game-Studios/.claude/skills/dev-story/SKILL.md engine/Claude-Code-Game-Studios/.claude/skills/gate-check/SKILL.md
~~~

将以下决定分类并写下各模式的预期动作：

| 决定 | Guided 下 major/minor？ | Autonomous 默认会询问吗？ | 是否必须记日志？ | 依据 |
| --- | --- | --- | --- | --- |
| 在已选定架构中调整一个标题 |  |  |  |  |
| 在已批准范围内确定核心循环方向（不改变范围） |  |  |  |  |
| 删除一个测试文件 |  |  |  |  |
| 新增 ADR 或改变系统边界 |  |  |  |  |

提示：删除测试文件属于默认 `file_deletions`；架构决策虽是可识别类别，但不在默认 always-ask 三项中。若是 guided 模式，重大且影响架构的选择仍属于 major；若是 autonomous，则需再确认项目有没有把 `architecture_decisions` 加入 always-ask 列表。若核心循环方向的调整会改变已批准范围，则还会命中默认 `scope_changes`。

然后对照 `/start` Phase 2、4、5 与 `/gate-check`：它们展示的是 Skill 明确要求的询问/豁免规则。不要把本次静态核对写成真实会话观察。

## 本课结论

先读有效的 `modes.automation` 与 `modes.automation_always_ask`，再看目标 Skill 怎样分类决定、在哪个节点提问、写入前如何等待，以及如何记录结果。Automation 调整交互节奏；它不取消未回答问题的等待规则，也不覆盖显式豁免 Skill 的人工审批。

## 简化说明

- `compare_automation_modes.py` 实际运行的是本地 CCGS 配置脚本；它验证设置值及来源，不模拟 Claude Code 的提问、写文件或日志对话。
- 本地 CCGS 快照没有一个配置完成的游戏项目，因此本课没有执行 `/start`、`/dev-story` 或 `/gate-check` 会话。Skill 中的文本是静态源码证据。
- 始终协作的 Skill 列表以及 always-ask 分类以本快照的 `automation-modes.md` 为准；新增 Skill 仍需按该合同接线，不能假设全仓所有操作自动一致。

## 自测

1. `guided` 与 `autonomous` 遇到 minor 决定时分别怎么处理？
2. 默认 `autonomous` 遇到文件删除和 schema 修改分别会怎样？
3. `architecture_decisions` 在类别表中出现，为什么不能据此断言它在默认项目里始终询问？
4. 问题被关闭或跳过后，Skill 能否把它理解为“同意”？
5. `/start` 的某些阶段为什么在 Automation 模式下仍然提问？
6. 决策日志能证明什么，不能取代什么？

答案应能指向脚本解析输出或相应 Skill / shared pattern 规则；没有实际执行的会话行为应标为未观察。
