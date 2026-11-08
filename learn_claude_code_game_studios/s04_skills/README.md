# 第 4 课：Skill 命令的结构

**目标：** 从用户输入的斜杠命令追到对应 Skill，并读出它的目标、输入、工具权限和主要流程。

## 源码位置

- `engine/Claude-Code-Game-Studios/.claude/skills/`：按命令名组织的 Skill 目录。
- `.claude/docs/skills-reference.md`：Skill 命令索引。
- `.claude/skills/start/SKILL.md`：短入口 Skill 样例。
- `.claude/skills/help/SKILL.md`：导航类 Skill 样例。

## 观察步骤

1. 从 README 的 `/start` 或 `/help` 命令找到同名目录。
2. 检查 frontmatter 中的 `description`、`allowed-tools` 和 `model`。
3. 阅读 Skill 的主流程，圈出输入、读取、决策和输出步骤。
4. 找出它引用的模板、文档或其他 Skill。

## 观察结果

Skill 将一个可重复的工作方法变成显式入口。短入口可以再把不常用细节放到 `references/` 或合同文件中；这样主流程保留在上下文中，细节按需加载。

## 实践

在副本的 Claude Code 会话中运行 `/help`，然后运行 `/settings`。从终端打开本次调用到的 `SKILL.md`，把回复中的建议步骤与 Skill 的输入、流程和输出逐项对照。

## 简化说明

frontmatter 中的工具和模型字段受 Claude Code 版本、调用方式和用户设置影响。本课只识别声明，不把声明等同于实际权限或实际模型日志。

## 自测

从一个命令写出“输入 → 读取哪些资料 → 主要决策 → 产出文件”的链路，并指出其允许调用的工具。
