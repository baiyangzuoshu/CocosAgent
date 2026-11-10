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

第 0 课通过 `audit_snapshot.py` 盘点快照；第 1 课通过 `trace_session_context.py` 检查启动导入和 Hook 目标；第 2 课通过 `inventory_agents.py` 盘点 Agent 定义；第 3 课通过 `trace_team_flow.py` 追踪 `team-*` Skill 的委派角色、并行提示、阶段依赖、门禁和阻塞恢复线索；第 4 课通过 `inspect_skill.py` 查看 Skill frontmatter、标题结构和动态输入线索；第 5 课通过 `trace_skill_dependencies.py` 追踪合同、参考资料和脚本路径；第 6 课在隔离副本中运行 CCGS 的 `yaml-helper.sh resolve_config`，并用 `config-set.sh --dry-run` 预览配置校验；第 7 课通过 `compare_rigor_tiers.py` 在临时配置副本中调用 CCGS 辅助脚本对比三种预设；第 8 课通过 `compare_automation_modes.py` 比较不同 Automation 设置与 always-ask 列表，再从真实 Skill 核对提问边界；第 9 课通过 `trace_hook_events.py` 静态追踪所有 Hook 事件注册及命令脚本路径；第 10 课通过 `trace_rule_scope.py` 盘点 Rule 的 paths frontmatter，并核对加载诊断事件；第 11 课通过 `inspect_engine_reference.py` 汇总引擎版本 Pin，并区分项目配置、默认导入和本机安装状态；第 12 课通过 `trace_onboarding_skills.py` 对照四个入门 Skill 的工具权限、确认步骤和交接点；第 13 课通过 `trace_design_chain.py` 对照概念、系统设计、ADR、需求追踪及两个 Registry 的文件状态；第 14 课通过 `trace_story_lifecycle.py` 调用 CCGS 自带的 Story 状态与事实/lint helper，观察状态清单和就绪检查输入；第 15 课通过 `trace_gate_flow.py` 运行阶段状态与 workflow catalog 观察脚本，对照阶段阶梯和 minimal 路线；第 16 课通过 `trace_qa_evidence.py` dry-run CCGS 测试 runner 并盘点 Story、截图、receipt、Smoke Check 与试玩证据。

第 17 课通过 inspect_studio_tests.py 盘点 CCGS 自测 catalog、spec 和 category，并调用只读 helper 输出结构观察；第 18 课通过 scaffold_custom_skill.py 在隔离副本中创建 Skill、路径 Rule、spec 和 catalog 登记，并用 helper 盘点 CSV；第 19 课通过 compare_ccgs_upgrade.py 在临时目录运行合成三方差异示例，也可对准备好的 base、local、upstream 目录做只读文件盘点，再依据版本专属升级清单制定迁移方案。该脚本不应用升级、不判断文件能否覆盖；第 20 课通过 exercise_release_guard.py 在临时 Git 仓库运行 CCGS 的 validate-push.sh 与 write-guard.sh，检查受保护分支提示和需要确认的发布动作，不会真正 push、merge 或创建 tag；第 21 课通过 exercise_launch_evidence.py 在两个临时项目中运行 CCGS 的 code-markers.sh 与 bug-stats.sh，对照有证据与无证据时的 NOT READY / NOT ASSESSED 区别。可再于隔离 CCGS 副本中运行真实 `/launch-checklist dry-run`。第 22 课通过 exercise_live_ops_content.py 在临时 Godot 项目中运行 CCGS 的 content-count.sh 和 registry.sh，观察 planned registry 项、引擎目录文件数、覆盖状态和无扫描根时的退出结果；它不会启动真实 Live Ops Agent 或生成赛季方案。第 23 课通过 exercise_economy_balance.py 读取 CCGS 的 registry.sh `get` 结果，并计算可编辑 CSV 中一组 faucet/sink 流量与购买周期；公式范围和经济数据均为合成值，脚本不替代真实 `/balance-check`。第 24 课通过 exercise_bug_triage.py 在临时缺陷目录调用 CCGS 的 bug-stats.sh，观察开放状态、系统热点和 S/P 示例；之后可用事故响应模板写一份隔离的演练记录。

第 25 课通过 `audit_analytics_contract.py` 审查合成事件定义、NDJSON 日志、A/B 实验窗口与隐私待决项；校验器是课程代码，不连接游戏，也不自动判定合规。

第 26 课通过 `exercise_security_scope.py` 将合成项目配置复制到临时目录，再调用 CCGS 的 `yaml-helper.sh get_yaml_key` 比较未设置与显式 `false` 的网络范围标记，并展示引擎参考覆盖不足时的 NOT ASSESSED 边界。它只做范围观察，不扫描游戏源码、依赖或运行中的游戏，也不代替真实安全审计。

如果没有可用的 Claude Code 运行环境，仍可运行 `audit_snapshot.py` 和 CCGS 自带的只读辅助脚本；需要真实会话行为的观察则记为未执行，不用静态文件代替运行结果。
