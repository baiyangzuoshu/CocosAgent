# 第 8 课：Collaborative、Guided 与 Autonomous

**目标：** 区分自动化模式对提问、推荐和写入确认的影响。

## 源码位置

- `engine/Claude-Code-Game-Studios/.claude/docs/automation-modes.md`：三种模式、决策分类和例外。
- `CLAUDE.md` 的 Collaboration Protocol。
- `.claude/docs/effects-map.md` 的 `modes.automation` 章节。

## 观察步骤

1. 比较 collaborative、guided、autonomous 对主要决策和普通细节的处理。
2. 记录 `automation_always_ask` 的默认类别。
3. 找出无论模式如何都保持协作式的 Skill。
4. 检查用户跳过或关闭问题时，Skill 是否允许代替用户选择。

## 观察结果

Automation 控制“决策时要不要停下来问”，不决定项目需要多少设计与 QA 工作。即使在 autonomous 模式，配置为 always-ask 的类别仍要等待用户；没有得到回答的问题不能当作批准。

## 简化说明

不同 Skill 还需按其决策类别应用统一规则。本课比较共享模式，不模拟真实的 AskUserQuestion 交互。

## 自测

判断“删除一份 GDD”在默认 autonomous 配置下是否可自动执行，并说明哪份文档定义此行为。
