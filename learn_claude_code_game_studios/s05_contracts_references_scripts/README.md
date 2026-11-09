# 第 5 课：合同、参考资料与脚本

**目标：** 追踪一项 Skill 如何依赖合同、条件参考资料和辅助脚本，并判断哪些是运行指令、哪些只是边界说明、哪些会读取或修改文件。

完成本课后，你应该能：

1. 从 Skill 正文追到它实际点名的参考文件和辅助脚本。
2. 用合同核对输入、输出、不可修改范围和下游依赖。
3. 区分脚本输出的观察事实与 Skill 自己作出的流程判定。
4. 在运行脚本前区分只读命令与写入命令。

## 问题

Skill 正文可能很长，但流程中的细节未必全写在一个文件里。一次流程可能需要合同、按条件加载 `references/` 中的资料，并调用 `.claude/scripts/` 的工具；要逐一核实它们如何连接。`/dev-story` 就是一个例子：合同与 Skill 并列存在，但正文没有直接引用它；参考资料和辅助脚本则有明确路径。脚本输出状态字段或 lint 命中，也不等于脚本替 Skill 作出了最终判断。

## 源码位置

| 文件 | 本课观察点 |
| --- | --- |
| `engine/Claude-Code-Game-Studios/.claude/skills/dev-story/SKILL.md` | 运行步骤、参考资料分支和脚本调用位置 |
| `engine/Claude-Code-Game-Studios/.claude/skills/dev-story/CONTRACT.md` | 前置条件、输入输出、不变量、下游约定和脆弱点 |
| `engine/Claude-Code-Game-Studios/.claude/skills/dev-story/references/version-mismatch.md` | ADR 或 manifest 版本不一致时才读的细节 |
| `engine/Claude-Code-Game-Studios/.claude/skills/dev-story/references/engine-checks.md` | Unity / Unreal 的解析和运行观察步骤 |
| `engine/Claude-Code-Game-Studios/.claude/scripts/story-facts.sh` | 故事文件字段与依赖的只读事实输出 |
| `engine/Claude-Code-Game-Studios/.claude/scripts/adr-status.sh` | ADR 状态、版本和缺失章节的只读事实输出 |
| `engine/Claude-Code-Game-Studios/.claude/scripts/md-section.sh` | Markdown 标题读取，以及按命令执行的文件修改 |

## 沿着 `/dev-story` 走一遍

### 1. Skill 是流程入口

`SKILL.md` 决定何时调用脚本、何时提问、何时继续，以及何时报告 `BLOCKED`。例如：

- Phase 2 用 `story-facts.sh` 查看依赖故事状态，并用 `adr-status.sh` 查看被引用 ADR 的状态和版本。
- 版本相同或未标注的常见路径沿用 Story 中的摘要；ADR 或 manifest 版本不一致时才读取 `references/version-mismatch.md`。
- Phase 6 对 Unity / Unreal 读取 `references/engine-checks.md`；Godot 则执行 Skill 中写明的检查步骤。
- Story 字段在用户确认后由 `md-section.sh set-field` 更新；提取章节用 `extract`，替换章节用 `replace`。

参考资料承担条件分支的细节，避免每次都把不相关的引擎步骤或版本处理规则塞进主流程。要判断某次会话是否真的读了它们，仍须看会话记录。

### 2. 合同描述流程边界

`dev-story/CONTRACT.md` 将接口整理成几类：输入文件与前置条件、会产生的文件、输出保证、不可修改范围、硬约束、`/story-done` 的下游要求和易出错点。比如，它说明 `/dev-story` 不负责把当前 Story 标成 Done；关闭 Story 是 `/story-done` 的职责。它也说明下游会依赖准确的 `## Test Evidence` 路径和 session checkpoint。

这里有一个需要核实的细节：**合同文件存在于 Skill 目录，不代表运行 `/dev-story` 时 Claude 会自动加载它。** 本快照的 `dev-story/SKILL.md` 没有直接写出 `CONTRACT.md` 路径。把合同当作流程接口的核对资料是合理的；把它说成必定进入了某次会话上下文则没有源码证据。

### 3. 脚本提供观察结果，Skill 解释并决策

`story-facts.sh`、`adr-status.sh` 和 `md-section.sh` 的头部注释都要求把它们的输出当作观察结果。`story-facts.sh` 返回 TSV 行、状态字段和 lint 命中；Skill 再结合 workflow 档位、依赖和 ADR 规则决定继续、询问还是阻塞。脚本对事实负责，流程判定仍在 Skill 中。

`md-section.sh` 同时提供只读与写入命令：

| 命令 | 用途 | 是否写文件 |
| --- | --- | --- |
| `list` | 列出 Markdown 标题及行号 | 否 |
| `status` | 汇总指定章节是否完整、为空或为占位内容 | 否 |
| `extract` | 读取一个章节 | 否 |
| `replace` / `insert-before` | 替换或插入章节正文 | 是 |
| `set-field` | 修改或补入一个字段 | 是 |

检查脚本可用的子命令，并不等于已授权或需要运行它的写入分支。阅读 Skill 中的确认条件，再选择命令。

## 实践一：静态追踪依赖文件

从仓库根目录运行：

~~~sh
python3 learn_claude_code_game_studios/practice/trace_skill_dependencies.py dev-story
~~~

脚本会列出 `CONTRACT.md` 是否存在以及 Skill 是否直接提到它，检查相对参考资料和脚本路径是否落在源码树中，并打印部分脚本接口注释。它只扫描文本，不执行 Skill 或脚本。

应观察到：

- `CONTRACT.md` 存在，但 `SKILL.md` 没有直接引用它。
- `version-mismatch.md` 和 `engine-checks.md` 两个路径均存在；Skill 的正文把它们放在不同条件分支中。
- `story-facts.sh`、`adr-status.sh`、`md-section.sh` 等辅助脚本路径存在。

把输出和原始 Skill 行号对照，给每种文件标记“直接调用 / 按条件读取 / 并列合同”，不要仅靠目录结构猜关系。

## 实践二：运行只读辅助命令

从仓库根目录进入 CCGS 快照：

~~~sh
cd engine/Claude-Code-Game-Studios
bash .claude/scripts/md-section.sh list .claude/skills/dev-story/CONTRACT.md
bash .claude/scripts/md-section.sh extract .claude/skills/dev-story/CONTRACT.md "Hard Constraints (Never Violate)" --body
bash .claude/scripts/story-facts.sh --help
bash .claude/scripts/adr-status.sh --help
~~~

`list` 应显示合同的章节与行号；`extract` 应输出硬约束正文；两个 `--help` 输出脚本的输入、结果格式和退出码。上述命令只读文件。本课不调用 `replace` 或 `set-field`，不修改源码中的合同或 Story。

按观察结果填写：

| 文件 / 工具 | 读取或输出什么 | 加载/调用条件 | 最终判定者 | 有无写入 |
| --- | --- | --- | --- | --- |
| `CONTRACT.md` |  |  |  |  |
| `version-mismatch.md` |  |  |  |  |
| `story-facts.sh` |  |  |  |  |
| `md-section.sh extract` |  |  |  |  |
| `md-section.sh set-field` |  |  |  |  |

核对时，`story-facts.sh` 的状态或 lint 命中是证据；`/dev-story` 根据规则作出继续或 BLOCKED 决定。`set-field` 会写文件，Skill 要求在变更 Story 状态前按流程取得确认。

## 本课结论

读 Skill 时沿正文找引用和调用，读合同确认接口和不变量，按条件才读取参考资料，最后检查脚本实际提供的输入、输出和写入方式。只有明确引用、实际脚本调用或会话记录才能证明关系；同目录放着的文件不等于自动加载。

## 简化说明

- `trace_skill_dependencies.py` 用路径和文本模式静态查找，不会理解条件逻辑，也不证明引用文件在运行时被打开。
- `CONTRACT.md` 在本快照中没有被 `/dev-story/SKILL.md` 直接引用；本课把它作为人类可读的接口核对资料，不推断它被自动注入或由特定测试执行。
- CCGS 快照没有 `production/epics/story-*.md` 的练习 Story，因此这里只运行 `story-facts.sh --help`，不伪造一个 Story 的状态结论。
- `md-section.sh` 的 `list` / `extract` 是只读示例；`replace` / `set-field` 属于写入操作。本课没有运行后者。
- 本课实跑的是本地辅助脚本，不是 `/dev-story` 的完整 Claude Code 会话流程。

## 自测

1. `CONTRACT.md` 存在于 Skill 目录中，为什么还不能说 `/dev-story` 会自动加载它？
2. `version-mismatch.md` 和 `engine-checks.md` 分别在什么条件下读取？
3. `story-facts.sh` 输出 `BLOCKED` 或 lint 命中后，谁决定工作流是否停止？
4. `md-section.sh extract` 与 `set-field` 的副作用有什么不同？
5. 你能指出一条由脚本输出证明的事实，以及一条必须从 Skill 正文才能得出的流程规则吗？

每项答案都应能定位到文件行号或刚运行的命令结果；没有运行的部分明确标为未执行。
