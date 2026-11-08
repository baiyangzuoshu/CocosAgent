# 实践环境

课程实践使用 CCGS 的真实配置和 Skill。先复制一份隔离工作区，再在工作区内运行 Claude Code；这样 `/start`、`/settings` 等可能写入文件的操作不会改动源码副本。

## 前置条件

- Claude Code 已安装并可启动。
- Python 3 和 Bash 可用。
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

目前只为第 0 课编写了练习步骤。可以运行 `audit_snapshot.py` 盘点源码，创建隔离副本后在其中启动 Claude Code、运行 `/help` 并观察 SessionStart 输出。

第 1–19 课目前只有大纲主题；对应的实践步骤会在逐课学习时再编写和验证。

如果没有可用的 Claude Code 运行环境，仍可运行 `audit_snapshot.py` 和 CCGS 自带的只读辅助脚本；需要真实会话行为的观察则记为未执行，不用静态文件代替运行结果。
