# 第 1 课：会话入口与上下文装配

**目标：** 追踪 CCGS 新会话会拿到哪些静态指令、哪些信息由 `SessionStart` Hook 生成，以及哪些资料只在需要时读取。

完成本课后，你应该能：

1. 从根 `CLAUDE.md` 找出本仓库明确导入的上下文文件。
2. 区分 `@` 导入、普通路径引用、目录级 `CLAUDE.md` 和 Hook 输出。
3. 通过实际命令核对 Hook 注册目标，并在隔离副本中观察会话恢复信息。

## 问题

打开项目时，CCGS 不会把每份说明文档都一股脑放进会话。根 `CLAUDE.md` 组合了长期有效的项目说明；`settings.json` 把动态信息接到会话事件；更具体的资料留到相关任务再读取。要回答“启动时 Claude 看到了什么”，必须分别追这三条路径。

## 上下文路径图

~~~text
Claude Code 启动在 CCGS 项目根目录
  ├─ 根 CLAUDE.md
  │    ├─ @.claude/docs/directory-structure.md
  │    ├─ @docs/engine-reference/godot/VERSION.md
  │    ├─ @.claude/docs/coordination-rules.md
  │    └─ @.claude/docs/coding-standards.md
  ├─ settings.json 的 SessionStart 事件
  │    ├─ .claude/hooks/session-start.sh
  │    └─ .claude/hooks/detect-gaps.sh
  └─ 任务需要时再读取
       ├─ .claude/docs/context-management.md
       ├─ .claude/docs/technical-preferences.md（配置缺项时）
       └─ 子目录中的 CLAUDE.md
~~~

`@` 导入和普通的反引路径不能混为一谈：根文件里的 `@path` 是导入声明；例如 `context-management.md` 虽然被提到，但根文件明确说要按需读取。子目录中的 `CLAUDE.md` 也属于更窄的范围，通常在相关目录成为工作目标时才加载。

## 源码对照

| 源码 | 观察点 | 能说明什么 |
| --- | --- | --- |
| `engine/Claude-Code-Game-Studios/CLAUDE.md:17-45` | 项目结构、引擎版本、协调规则的 `@` 导入 | 根入口明确列出的静态上下文 |
| `engine/Claude-Code-Game-Studios/CLAUDE.md:68-83` | Coding Standards 导入、按需资料与 checkpoint 约定 | 哪些规则被直接导入，哪些只被引用 |
| `engine/Claude-Code-Game-Studios/.claude/settings.json:150-165` | `SessionStart` 下两个命令 Hook | 事件配置指向的脚本及空 matcher |
| `engine/Claude-Code-Game-Studios/.claude/hooks/session-start.sh:264-345` | `active.md` 与 `CHECKPOINT` 区域 | Hook 如何把恢复线索打印出来 |
| `engine/Claude-Code-Game-Studios/.claude/hooks/detect-gaps.sh` | 新项目识别和文档缺口检查 | 第二个启动脚本产生的观察信息 |
| `engine/Claude-Code-Game-Studios/design/CLAUDE.md`、`docs/CLAUDE.md`、`src/CLAUDE.md`、`studio-tests/CLAUDE.md` | 子目录入口 | 目录相关指令的边界 |

Claude Code 官方文档说明，`@` 导入的文件会与引用它的 `CLAUDE.md` 一起加载；`/context all` 可以查看实际加载的指令文件。`SessionStart` 在新会话或恢复会话时触发，命令 Hook 的标准输出会作为上下文提供给 Claude。官方文档会更新，实机行为应以正在使用的 CLI 版本为准：[Memory 与 CLAUDE.md](https://code.claude.com/docs/en/memory)、[Hooks 与 SessionStart](https://code.claude.com/docs/en/hooks)。

## 观察结果

这份快照的启动上下文分成三类：

1. **静态导入：** 根 `CLAUDE.md` 的四条 `@` 路径会将对应文件内容并入项目指令。
2. **事件输出：** `settings.json` 注册 `session-start.sh` 和 `detect-gaps.sh`。前者会输出分支、配置概况和可选 checkpoint；后者检查项目状态。只看到注册项只能证明有配置，不能证明某次会话运行过脚本。
3. **按需资料：** 根文件将上下文管理说明标记为按需读取；技术偏好只在 `project.yaml` 缺少相应配置时作为旧式回退。子目录也各有自己的 `CLAUDE.md`。

因此，`CLAUDE.md` 负责稳定项目指令，Hook 负责会话时才知道的状态，按需文档负责压低无关上下文的启动成本。它们不是同一种“加载”。

## 实践一：追踪真实引用

在仓库根目录运行课程工具：

~~~sh
python3 learn_claude_code_game_studios/practice/trace_session_context.py
~~~

检查输出是否列出四个直接导入、两个按需文档，以及两个 `SessionStart` Hook 文件。再把 CCGS 源码目录作为参数传入，确认工具能对另一份快照做同一检查：

~~~sh
python3 learn_claude_code_game_studios/practice/trace_session_context.py /path/to/Claude-Code-Game-Studios
~~~

该程序只解析当前根 `CLAUDE.md` 中的直接导入和按需引用，并核对 Hook 命令目标文件是否存在；它不递归展开导入，也不执行 Hook。

## 实践二：观察恢复 Hook

在仓库根目录创建一个位于系统临时目录的副本，避免 CCGS 脚本误读当前仓库的 Git 分支：

~~~sh
CCGS_S01_TMP=$(mktemp -d)
python3 learn_claude_code_game_studios/practice/create_sandbox.py engine/Claude-Code-Game-Studios "$CCGS_S01_TMP/workspace"
git -C "$CCGS_S01_TMP/workspace" init -q
cd "$CCGS_S01_TMP/workspace"
~~~

先直接观察真实 Hook 脚本的输出：

~~~sh
bash .claude/hooks/session-start.sh
~~~

接着在**这个临时副本**里放一个短 checkpoint，再运行脚本：

~~~sh
mkdir -p production/session-state
cat > production/session-state/active.md <<'EOF'
<!-- CHECKPOINT -->
Task: inspect CCGS startup context
Next: compare startup instructions and hook output
Blockers: none
Files: production/session-state/active.md
<!-- /CHECKPOINT -->
EOF
bash .claude/hooks/session-start.sh
~~~

观察 `ACTIVE SESSION STATE DETECTED` 和 `Checkpoint:` 之后的文字。此处是直接运行 CCGS 脚本，能验证它在当前副本中的输出；它还不是 Claude Code 调度 Hook 的运行证据。

最后在同一个副本里启动真实 Claude Code 会话：

~~~sh
claude
~~~

会话开始后运行 `/context all`，记录 Memory files 中出现的根指令和导入文件，并观察启动时是否收到 Hook 输出。退出后可删除刚才新建的临时目录 `$CCGS_S01_TMP`。

## 证据边界

| 操作 | 可以证明 | 不能单独证明 |
| --- | --- | --- |
| `trace_session_context.py` | 当前文件中的直接引用和 Hook 目标存在 | Claude Code 实际加载或运行了它们 |
| 手动运行 `session-start.sh` | 脚本在该副本和环境下输出什么 | Claude Code 在真实 `SessionStart` 事件中调用了它 |
| 新会话中的 `/context all` 与启动观察 | 当前 CLI 会话显示了哪些指令及启动信息 | Hook 在所有环境、所有启动来源下都成功 |

## 简化说明

- `trace_session_context.py` 只读根 `CLAUDE.md` 的直接引用，不模拟 Claude Code 的完整加载算法。
- `SessionStart` Hook 的事件语义以 Claude Code 官方文档和实际 CLI 为准；CCGS 源码本身只证明配置与脚本内容。
- 临时 checkpoint 只在隔离副本中创建，不能写入 `engine/Claude-Code-Game-Studios/`。

## 自测

1. 哪四份文件通过根 `CLAUDE.md` 的 `@` 语法导入？
2. 为什么 `.claude/docs/context-management.md` 不应列入这四份启动导入？
3. `settings.json` 中注册了什么？单看配置还缺哪一步证据？
4. 手动运行 Hook、真实启动 Claude Code、运行 `/context all`，三者分别增加了什么证据？

能从源文件定位每个结论，并区分“已注册”“脚本可运行”和“真实会话已观察”，即完成本课。
