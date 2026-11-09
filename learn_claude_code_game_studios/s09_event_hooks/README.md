# 第 9 课：事件 Hooks

**目标：** 从 `settings.json` 的事件注册一路追到 Hook 脚本，并判断一次 Hook 是阻止工具调用、发送提醒，还是只记录信息。

完成本课后，你应该能：

1. 从事件、matcher、命令和 timeout 读出 Hook 的触发范围。
2. 区分 `PreToolUse`、`PostToolUse`、会话/压缩和 Subagent 事件的时序。
3. 根据事件输出契约区分阻止、可见警告和后台记录。

## 问题

在 `.claude/hooks/` 下找到一个脚本，并不能证明它已经注册；在 `.claude/settings.json` 里找到命令，也不能只凭文件名知道它会不会阻止操作。需要连起来看：事件何时触发、matcher 筛选什么、命令指向哪个文件、Hook 的退出码或 JSON 如何被 Claude Code 处理。

## 源码位置

| 文件 | 本课观察点 |
| --- | --- |
| `engine/Claude-Code-Game-Studios/.claude/settings.json` | `hooks` 下的事件、matcher、命令、timeout 与 async 配置 |
| `engine/Claude-Code-Game-Studios/.claude/docs/hooks-reference.md` | 当前已注册 Hook 的目标行为，以及有意未注册的事件 |
| `engine/Claude-Code-Game-Studios/.claude/docs/hooks-reference/hook-input-schemas.md` | 各事件输入字段、stdout/stderr、退出码及 Hook JSON 的可见性 |
| `engine/Claude-Code-Game-Studios/.claude/hooks/validate-read.sh` | 一个确实能在工具执行前拒绝操作的例子 |
| `engine/Claude-Code-Game-Studios/.claude/hooks/validate-registry.sh` | 一个只发警告、不阻止写入的例子 |
| `engine/Claude-Code-Game-Studios/.claude/hooks/validate-assets.sh` | 工具已经写入后再检查的例子 |
| `engine/Claude-Code-Game-Studios/.claude/hooks/session-stop.sh` | 每轮响应结束时异步写 session 记录的例子 |

第 1 课只追踪了 `SessionStart` 的启动上下文装配；本课盘点整个 `hooks` 配置，并重点区分工具调用前后及后台事件的效果。

## 注册如何连到脚本

读取一个 Hook 注册时按以下顺序核对：

1. **Event：** 什么时候触发，例如 `PreToolUse` 或 `SubagentStop`。
2. **Matcher：** 哪类工具或通知会进入此注册，例如 `Read`、`Write|Edit` 或 `Bash|PowerShell`。空 matcher 表示该事件没有额外筛选条件。
3. **Command：** 此处通过 `$CLAUDE_PROJECT_DIR/.claude/hooks/<name>.sh` 找到执行脚本。
4. **执行限制：** `timeout` 是该 Hook 的运行上限；`async: true` 表示调用方不等待其完成。
5. **脚本与协议：** 再看 Hook 读什么 stdin、写什么 stdout/stderr、以什么退出码结束。

本快照在 8 种事件中注册了 15 条命令。`SessionStart` 加载会话线索并检查缺失文档；`PreToolUse` 按 Bash/PowerShell、Write/Edit、Read 分组检查；`PostToolUse` 在写入后校验资产或提示检查 Skill；`PreCompact` 记录压缩；`Stop` 异步记 session 信息；Subagent 事件记调用记录并检查交付文件。`Notification` 用于在权限等待或空闲时发系统通知。

## 阻止、警告与记录不是同一效果

| 示例 | 事件/时序 | 行为 | 为什么 |
| --- | --- | --- | --- |
| `validate-read.sh` | `PreToolUse`，`Read` 发生前 | 大文档整文件读取会被拒绝；提示标题行和分段读取方式 | 在 `PreToolUse` 中退出 2 会阻止该次调用；范围读取可以继续 |
| `validate-registry.sh` | `PreToolUse`，`Write|Edit` 前 | 发现可能删除、重排 Registry 条目等问题时发提醒，但写入继续 | Hook 用 `hook_warn` 输出可见 JSON 并退出 0；它没有返回 permission deny |
| `validate-assets.sh` | `PostToolUse`，`Write|Edit` 后 | 检查 JSON 数据和 Godot 资源命名；错误可反馈给 Claude 修正 | 工具已经执行，`PostToolUse` 不能撤销或阻止刚才的写入 |
| `session-stop.sh` | `Stop`，每次响应结束 | 更新会话日志/成本记录，异步运行 | 它是记录用途；`Stop` 不是“用户退出程序时才触发”的别名 |

### Hook 的输出契约

- `PreToolUse` 退出 2：阻止工具执行，stderr 给 Claude 说明原因。退出 0：进入正常权限流程；它本身**不会批准**工具，也不会跳过用户权限确认。
- 可见的非阻止提醒：退出 0，并在 stdout 输出 Hook JSON（`systemMessage` / `additionalContext`）。退出 0 的 stderr 只进 debug log，不是用户可见提醒。
- `PostToolUse` 已经晚于工具操作。退出 2 可把 stderr 反馈给 Claude，帮助修复已写内容；它并不把原操作改成“未发生”。
- Hook JSON 的 stdout 只能放该 JSON 对象；`PreToolUse` 的 `permissionDecision: "allow"` 会跳过原有权限提示，提醒 Hook 不应随便添加它。

`hooks-reference.md` 提到的 `hook_warn` 就是 CCGS 为可见提醒准备的辅助函数；不要只看脚本 `echo` 或 stderr 就推断 Claude Code 会把内容显示出来。

## 还有两个时序细节

- `SessionStart` stdout 会加入 Claude 上下文，可在 compaction 后重新装载恢复线索；`PreCompact` 的 stdout 不会传给 Claude，因此该 Hook 只追加日志。
- `Stop` 在**每次响应结束**时触发，本快照为它配置了 `async: true`。`session-stop.sh` 通过内容哈希避免每轮都重复归档未变化的 session state。

“可用事件”不等于“都要注册”。本快照没有注册 `UserPromptSubmit`，因为每条用户消息都重复注入 session state 会造成无必要开销；没有用 `ConfigChange` 监听 `project.yaml`，因为该事件不监视这份 CCGS 配置。具体取舍见 `hooks-reference.md` 的未采用事件表。

## 实践一：静态追踪全部已注册 Hook

从仓库根目录运行：

~~~sh
python3 learn_claude_code_game_studios/practice/trace_hook_events.py
~~~

脚本解析真实 `settings.json`，按事件和 matcher 列出命令目标、timeout、async 状态，并确认目标脚本在源码树中存在。当前快照应显示 8 种事件、15 个注册命令、0 个路径或配置问题。

从输出选一个事件，填表：

| Event | Matcher | 命令脚本 | timeout / async | 触发后动作证据在哪里 |
| --- | --- | --- | --- | --- |
| `PreToolUse` |  |  |  |  |
| `PostToolUse` |  |  |  |  |
| `Stop` |  |  |  |  |
| `SubagentStop` |  |  |  |  |

路径存在检查不能证明 Claude Code 实际触发过命令。要判断行为，请继续读 Hook 脚本和输入/输出合同。

## 实践二：比较一个拒绝、一个警告、一个事后检查

仍从仓库根目录运行：

~~~sh
sed -n '9,14p' engine/Claude-Code-Game-Studios/.claude/docs/hooks-reference/hook-input-schemas.md
sed -n '26,31p' engine/Claude-Code-Game-Studios/.claude/hooks/validate-read.sh
sed -n '60,70p;120,124p' engine/Claude-Code-Game-Studios/.claude/hooks/validate-registry.sh
sed -n '75,80p' engine/Claude-Code-Game-Studios/.claude/docs/hooks-reference/hook-input-schemas.md
sed -n '143,164p' engine/Claude-Code-Game-Studios/.claude/hooks/validate-assets.sh
~~~

依据 matcher、脚本和 Hook 输入/输出合同完成：

| 检查 | 工具执行前还是后 | 对工具的实际效果 | 给谁看的输出 |
| --- | --- | --- | --- |
| 整文件读取超出 Read Guard 阈值 |  |  |  |
| Registry 修改会删除条目 |  |  |  |
| 写入了非法 JSON 资产 |  |  |  |

解释第三行为什么即使属于“build-breaking issue”，也不能说明刚才的 Write/Edit 被阻止。答案必须同时提及 Event 时序和退出码处理。

本练习只读取注册与脚本文本，不直接运行 Hook。Hook 通常从 stdin 读取 Claude Code 的事件 JSON；有些会写 session 日志或运行平台通知命令。空输入下执行它们不能代替事件测试，还可能产生副作用。

## 本课结论

先从 `settings.json` 确认 Hook 是否注册以及 matcher 命中范围，再从对应脚本确认工作，从 `hook-input-schemas.md` 确认输出最终如何处理。只有位于工具调用前的阻断路径才可能阻止该操作；警告、事后校验和异步日志提供的是不同类型的反馈证据。

## 简化说明

- `trace_hook_events.py` 静态解析当前 `settings.json` 的 `$CLAUDE_PROJECT_DIR` 命令目标；它不调用 Hook、不模拟 stdin、不证明运行时调度。
- 示例中 Hook 的行为来自 CCGS 1.2.0 快照注释和本地 Hook Schema 文档；本课没有运行 Claude Code 或验证 UI 中警告的呈现。
- `settings.json` 还包含 permissions 和 statusLine 等设置；本课只分析 `hooks` 字段，不把这些配置混作 Hook。
- 多个 Hook 会调用 `.claude/scripts/` 下的辅助脚本；本课选择三个典型效果追踪，没有逐个审计所有辅助脚本。

## 自测

1. `PreToolUse` 的 matcher 和 Hook command 分别回答什么问题？
2. 为什么退出 0 并把警告写入 stderr 通常不会向用户或 Claude 发出可见提醒？
3. `PostToolUse` 退出 2 可以反馈什么，不能做到什么？
4. `Stop` Hook 是每轮响应还是仅会话关闭时触发？本快照的该 Hook 是否同步执行？
5. `validate-read.sh` 和 `validate-registry.sh` 为什么不能都归类为“阻止写入/读取”？
6. 路径静态检查通过，仍然不能证明 Hook 运行过的原因是什么？

每项答案应能定位到注册、脚本或事件 Schema；静态读取与真实事件运行分开记录。
