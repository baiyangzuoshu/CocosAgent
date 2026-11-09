# 第 10 课：路径 Rules

**目标：** 从 Rule 的 `paths:` frontmatter 推断它何时进入上下文，并分清文本指导与实际的强制校验。

完成本课后，你应该能：

1. 从 Rule 路径模式判断哪些文件被它覆盖。
2. 说明“读取匹配文件”和“创建匹配文件”对加载规则的区别。
3. 从独立的权限、Hook 或测试配置确认某个要求是否真的会被强制执行。

## 问题

`.claude/rules/` 中的 Markdown 文件看起来像“规则”，但这个名字本身不能证明它每轮都会加载，也不能证明工具会拒绝违规操作。需要分别核实 Rule 的加载范围、加载时机和正文如何被执行。路径模式描述的是上下文范围；写在正文里的要求仍是交给模型遵循的指导。

## 源码位置

| 文件 | 本课观察点 |
| --- | --- |
| `engine/Claude-Code-Game-Studios/.claude/rules/` | 14 个 Rule 文件的 `paths:` frontmatter 与正文约束 |
| `engine/Claude-Code-Game-Studios/.claude/docs/rules-reference.md` | Rule 如何加载、路径 globs 的说明，以及 Guidance 与 Enforcement 的边界 |
| `engine/Claude-Code-Game-Studios/.claude/settings.json` | 独立于 Rule 的工具权限 deny 项，以及是否注册 `InstructionsLoaded` |
| `engine/Claude-Code-Game-Studios/.claude/hooks/log-instructions.sh` | 可选的加载事件诊断日志实现 |
| `engine/Claude-Code-Game-Studios/.claude/hooks/validate-assets.sh` | 仅对某些资产写入提供的事后 Hook 校验示例 |

## 三个不同问题

### 1. Rule 什么时候加载？

本快照的 `rules-reference.md` 说明：带 `paths:` 的 Rule 在 Claude Code **读取**匹配文件时才加载，不会在每次工具调用时都加载，也不会因为新建一个匹配路径的文件而自动加载。一个 Skill 创建了新文件，但之前没有读取任何匹配文件时，不能仅凭“目标路径命中规则”断定模型已经看到那条 Rule。

如果某个 Rule 没有 `paths:`，它会每个会话都加载，优先级与 `.claude/CLAUDE.md` 相同。这会固定消耗会话上下文，应该是有意选择。静态扫描能列出 frontmatter，却不能告诉你某次运行里哪个 Rule 实际进入上下文。

### 2. `paths:` 描述什么范围？

它列出匹配文件路径的 glob。示例：

| Rule | 示例路径 | 读取匹配文件时的 Rule |
| --- | --- | --- |
| `gameplay-code.md` | `src/gameplay/combat.gd` | Gameplay 代码指导 |
| `test-standards.md` | `tests/unit/combat_test.gd` | 测试命名、结构、隔离与回归测试指导 |
| `skill-authoring.md` | `.claude/skills/dev-story/SKILL.md` | Skill 与 Gate 编写约定 |
| `agent-memory.md` | `.claude/agent-memory/qa-tester.md` | Agent memory 的用途和写入边界 |
| `scene-files.md` | `Scenes/arena.tscn` 或 `Assets/Scenes/Arena.unity` | 编辑器写入 Scene/Asset 文件的指导 |

路径模式在 CCGS 的规则参考中按 gitignore 风格解释；大小写不敏感是该文档注明的 Claude Code 2.1.282 观测结果，不应外推到未核验的版本。本课的脚本只打印模式，**不自行模拟 Claude Code 的 glob 匹配**。

### 3. Rule 是不是强制机制？

`.claude/rules/*.md` 里的文本随上下文提供给模型；它本身不会像 `PreToolUse` Hook 的退出 2 那样取消工具调用。因此 `rules-reference.md` 表格中的 **Enforces** 应理解为“该 Rule 说明/指导什么”，不是独立的拒绝器。

例如 `scene-files.md` 告诉模型不要手工改动某些编辑器 Scene 文件。但 `settings.json` 另有针对 `Edit(**/*.uasset)` 和 `Edit(**/*.umap)` 的 deny 权限规则；这是工具权限层的配置，不能说成 Markdown Rule 自己拦截了编辑。`data-files.md` 的 JSON 指导也不等于所有 JSON 都自动有效——需要再看 Hook 或提交检查覆盖了哪些路径与时点。

Rule 与 Agent 文件若重复表达同一约定，`rules-reference.md` 要求它们保持一致；相互矛盾的提示会被模型任意取舍，无法靠文件优先级推导唯一结果。

对照时还能发现一处文档描述不一致：`rules-reference.md` 的表格把 `agent-memory.md` 作用域列为 `.claude/agent-memory/**`；文末却称 `skill-authoring.md` 是唯一一个覆盖框架自身路径的 Rule，并说其余规则都作用于游戏目录。实际 frontmatter 显示这两条都覆盖框架路径。本课以各 Rule 的 frontmatter 判断路径范围，并把文末的“唯一”说法记录为需要维护的文档差异。

## 实际加载记录：有脚本不等于已启用

快照里有 `.claude/hooks/log-instructions.sh`，它是一个 `InstructionsLoaded` 诊断 Hook，可记录指令文件加载来源，例如 `path_glob_match` 或 `nested_traversal`。但当前 `.claude/settings.json` 没有注册 `InstructionsLoaded`。所以“脚本存在”不能证明规则加载日志已经在这个项目启用。

要观察真实加载事件，需确认该事件被接入并在对应 CCGS 会话中生成日志；本课只检查配置、模式和现存日志 Hook 文件，不把它们伪装成一次实机加载记录。

## 实践一：列出所有 Rule 的作用路径

从仓库根目录运行：

~~~sh
python3 learn_claude_code_game_studios/practice/trace_rule_scope.py
~~~

脚本解析 Rule frontmatter，打印每个文件的 `paths:` 列表，并查看 `InstructionsLoaded` 是否注册。当前快照应显示 14 个路径限定 Rule、0 个 session-wide Rule；日志脚本存在，但事件未注册。

选取三条模式，手工填写：

| Rule | frontmatter 模式 | 读这个路径会加载吗？ | 只创建新文件会触发吗？ | 是否存在独立强制机制？ |
| --- | --- | --- | --- | --- |
| `gameplay-code.md` |  |  |  |  |
| `skill-authoring.md` |  |  |  |  |
| `scene-files.md` |  |  |  |  |

核对时按“读取一个匹配文件”的语义推断加载，不要把路径范围误写成“工具写入这个路径时必定加载”。最后一列必须另找权限、Hook 或其他校验来源。

## 实践二：将一条指导与真正的拒绝器对照

从仓库根目录运行：

~~~sh
sed -n '1,24p' engine/Claude-Code-Game-Studios/.claude/docs/rules-reference.md
sed -n '1,40p' engine/Claude-Code-Game-Studios/.claude/rules/scene-files.md
rg -n 'uasset|umap' engine/Claude-Code-Game-Studios/.claude/settings.json
rg -n 'InstructionsLoaded|log-instructions' engine/Claude-Code-Game-Studios/.claude/settings.json engine/Claude-Code-Game-Studios/.claude/docs/rules-reference.md
~~~

回答三个问题：

1. `scene-files.md` 里关于手工修改 `.unity` / `.prefab` 的要求是什么？它加载时机如何？
2. `settings.json` 的 deny 项实际覆盖了哪些工具与文件后缀？是否覆盖该 Rule 的所有指示？
3. `log-instructions.sh` 文件存在，但配置没有注册其事件时，能否用它证明某条 Rule 本次已经加载？

此处只静态读取配置。不要为了制造“违反 Rule”的情况而编辑真实 Scene/Prefab，也不要把 Rule 提示称作已实测拦截。

## 本课结论

阅读 Rule 时依次看 frontmatter 路径、加载事件语义和正文建议，再去找权限或 Hook 判断哪些部分属于硬性门禁。路径静态盘点能回答“声明了哪些覆盖范围”，实际加载日志才能回答“某次会话加载了哪条规则”；只有独立执行机制才能证明模型以外的强制性。

## 简化说明

- `trace_rule_scope.py` 只解析 YAML frontmatter 中的 `paths:` 列表与诊断 Hook 注册状态，不检查 Claude Code 是否按 glob 实际加载了 Rule。
- 本课的大小写不敏感结论沿用 `rules-reference.md` 对 Claude Code 2.1.282 的本地观测记录；其他版本需要重新确认。
- 本地快照没有配置完成的游戏工程，也没有运行实际文件读取/写入流程；所有加载判断都是按文档语义进行的路径推演。
- 一个 Rule 可以与 Hook、权限和 Skill 自身的重复检查共同工作；单独看 Rule 内容无法证明这些配套机制覆盖所有情形。

## 自测

1. `paths: src/gameplay/**` 的 Rule 在什么事件下进入上下文？
2. 一个 Skill 直接创建 `src/gameplay/new-feature.gd`，为什么不能推断 `gameplay-code.md` 已经加载？
3. 没有 `paths:` 的 Rule 与本快照中的路径 Rule 有何加载成本差异？
4. 为什么 `rules-reference.md` 中名为 “Enforces” 的栏目不能等同于 Hook 的阻止行为？
5. `log-instructions.sh` 存在、但 `InstructionsLoaded` 未注册，分别能证明什么？

每项答案应能指向 frontmatter、规则参考文档或设置配置；没观察到的运行时加载要明确标为未观察。
