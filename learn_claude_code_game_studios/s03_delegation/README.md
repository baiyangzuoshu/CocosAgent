# 第 3 课：委派、团队与冲突升级

**目标：** 理解 CCGS 如何安排纵向委派、同级咨询、跨域协调和并行工作。

## 源码位置

- `engine/Claude-Code-Game-Studios/.claude/docs/coordination-rules.md`：Agent 协作规则。
- `.claude/docs/agent-teams.md`：实验性 Agent Teams 说明。
- `.claude/skills/team-combat/SKILL.md`：多专业角色协作样例。

## 观察步骤

1. 找出纵向委派、横向咨询和冲突升级分别由什么规则约束。
2. 读一个 `team-*` Skill，按执行顺序列出参与的 Agent。
3. 标出哪些任务可以并行，哪些任务要等前一步产物。
4. 对照文档，区分单会话内的 subagent 和跨会话的 Agent Teams。

## 观察结果

跨域决策需要协调角色；同级 Agent 可以咨询但不能替其他领域作最终决定。只有输入彼此独立的工作才适合并行；依赖阶段必须等待，阻塞结果要显式报告。

## 实践

在副本中调用 `/team-combat`，给出一个小型战斗功能需求，并说明这次只需要方案。回答它提出的必要问题后，记录实际委派的 Agent、并行任务和等待关系；拒绝任何未经你批准的文件写入。

## 简化说明

协调规则描述预期的委派边界；本课实践只观察当前会话实际启动的 subagent，不启用实验性的跨会话 Agent Teams。

## 自测

用“战斗系统同时改动技能、UI 与音效”为例，画出负责协调的 Agent、并行子任务和可能的升级路径。
