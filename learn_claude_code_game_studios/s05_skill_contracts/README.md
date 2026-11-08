# 第 5 课：合同、参考资料与脚本

**目标：** 看懂一个较复杂 Skill 如何用合同、分阶段参考文件和辅助脚本控制上下文与流程。

## 源码位置

- `engine/Claude-Code-Game-Studios/.claude/skills/dev-story/SKILL.md`：Story 实现主流程。
- `.claude/skills/dev-story/CONTRACT.md`：流程义务与阶段检查清单。
- `.claude/skills/dev-story/references/`：按阶段加载的细节。
- `.claude/scripts/`：可重复的读取、核对和数据整理脚本。

## 观察步骤

1. 先读 `SKILL.md` 的阶段名，不加载所有 reference。
2. 选一个具体阶段，打开它要求的合同或 reference。
3. 找一个被调用的 helper 脚本，记录它输入什么、输出什么。
4. 比较“规定必须做什么”和“脚本能观察什么”。

## 观察结果

Skill 入口负责调度；合同强调不可漏掉的义务；references 承载细节；脚本提供可重复的观察结果。仓库约定脚本报告观察，不替 Agent 对质量作最终判断。

## 简化说明

本课只追一段主流程，不逐项读完 Dev Story 的所有阶段文件，也不执行会写入项目数据的脚本。

## 自测

选出 Dev Story 中一项合同义务，指出相应流程步骤和可辅助核对它的脚本；说明脚本输出为何不能自动替代最终判断。
