# 实践环境

课程实践使用 CCGS 的真实配置和 Skill。先复制一份隔离工作区，再在工作区内运行 Claude Code；这样 `/start`、`/settings` 等可能写入文件的操作不会改动源码副本。

## 前置条件

- Claude Code 已安装并可启动。
- Python 3 和 Bash 可用。
- Git 可用（第 1 课会在隔离副本中初始化 Git 元数据）。
- 有本地 CCGS 1.2.0 源码目录。默认位置是仓库中的 `engine/Claude-Code-Game-Studios/`；若源码不在此处，把实际路径传给创建脚本。

## 第一步：检查当前快照

从仓库根目录运行：

~~~sh
python3 learn_claude_code_game_studios/practice/audit_snapshot.py
~~~

脚本会读取源码目录并报告版本、Agent、Skill、Hook 注册、Hook 脚本和 Rule 数量，不会修改文件。

## 第二步：创建可操作副本

~~~sh
python3 learn_claude_code_game_studios/practice/create_sandbox.py
~~~

如源码位于别处：

~~~sh
python3 learn_claude_code_game_studios/practice/create_sandbox.py /path/to/Claude-Code-Game-Studios
~~~

默认副本位于 `learn_claude_code_game_studios/practice/workspace/`，该目录被 Git 忽略。脚本不会覆盖已存在的目标目录；如需重建，先自行移走或清理该练习副本。

## 第三步：启动真实工作流

~~~sh
cd learn_claude_code_game_studios/practice/workspace
claude
~~~

进入后先运行 `/help` 和 `/settings`。SessionStart Hook 会在会话启动时运行；之后按课程逐步调用 Skill、观察 Hook、编辑副本配置并检查结果。所有会写文件的命令都限制在这个副本中。

## 当前练习

第 0 课通过 `audit_snapshot.py` 盘点快照；第 1 课通过 `trace_session_context.py` 检查启动导入和 Hook 目标；第 2 课通过 `inventory_agents.py` 盘点 Agent 定义；第 3 课通过 `trace_team_flow.py` 追踪 `team-*` Skill 的委派角色、并行提示、阶段依赖、门禁和阻塞恢复线索；第 4 课通过 `inspect_skill.py` 查看 Skill frontmatter、标题结构和动态输入线索；第 5 课通过 `trace_skill_dependencies.py` 追踪合同、参考资料和脚本路径；第 6 课在隔离副本中运行 CCGS 的 `yaml-helper.sh resolve_config`，并用 `config-set.sh --dry-run` 预览配置校验；第 7 课通过 `compare_rigor_tiers.py` 在临时配置副本中调用 CCGS 辅助脚本对比三种预设；第 8 课通过 `compare_automation_modes.py` 比较不同 Automation 设置与 always-ask 列表，再从真实 Skill 核对提问边界；第 9 课通过 `trace_hook_events.py` 静态追踪所有 Hook 事件注册及命令脚本路径；第 10 课通过 `trace_rule_scope.py` 盘点 Rule 的 paths frontmatter，并核对加载诊断事件；第 11 课通过 `inspect_engine_reference.py` 汇总引擎版本 Pin，并区分项目配置、默认导入和本机安装状态。

第 12–19 课目前只有大纲主题；对应的实践步骤会在逐课学习时再编写和验证。

如果没有可用的 Claude Code 运行环境，仍可运行 `audit_snapshot.py` 和 CCGS 自带的只读辅助脚本；需要真实会话行为的观察则记为未执行，不用静态文件代替运行结果。
