# 第 9 课：事件 Hooks

**目标：** 从 Claude Code 事件配置追到 Hook 脚本，并区分阻止、警告、提示和记录。

## 源码位置

- `engine/Claude-Code-Game-Studios/.claude/settings.json`：Hook 事件注册。
- `.claude/docs/hooks-reference.md`：触发时机和行为说明。
- `.claude/hooks/validate-read.sh`、`validate-write.sh`、`session-start.sh`：不同结果类型的例子。
- `.claude/hooks/yaml-helper.sh`：被其他脚本复用的辅助程序。

## 观察步骤

1. 在 `settings.json` 中选一个事件，沿 command 路径找到脚本。
2. 对比 `validate-read.sh` 的阻止行为、`validate-write.sh` 的警告和 `session-start.sh` 的启动提示。
3. 核对 README 统计的 15 个事件 Hook 与目录中的 18 个 `.sh` 文件。
4. 找出辅助脚本和可选诊断脚本，避免把它们误算成注册事件。

## 观察结果

Hook 由配置中的事件触发，作用范围取决于匹配的工具和输入；各脚本的失败语义不同。目录中 18 个脚本包含 15 个注册事件脚本以及辅助和诊断脚本。

## 实践

先在副本终端执行 `wc -c .claude/docs/effects-map.md`。如果文件大于配置的读取上限，在 Claude Code 会话里要求整份读取该文件；观察 `validate-read.sh` 的拒绝提示和章节行号，再按提示只读取一个指定章节。

## 简化说明

本课的读取拒绝练习只验证当前 Claude Code 与当前配置中的这一类 Hook；不能据此证明其他事件或版本都传入相同输入结构。

## 自测

对一个 Hook 画出“事件 → matcher → 脚本 → 对用户/模型的结果”，并标明它会阻止操作还是只报告问题。
