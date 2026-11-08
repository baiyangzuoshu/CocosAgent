# 第 15 课：阶段、Gate 与推进条件

**目标：** 区分阶段清单、评审 Gate 和用户决定是否推进。

## 源码位置

- `engine/Claude-Code-Game-Studios/.claude/docs/workflow-catalog.yaml`：阶段顺序、命令和产物检查。
- `.claude/skills/gate-check/SKILL.md`、`CONTRACT.md`：Gate 执行要求。
- `.claude/docs/director-gates.md`：Director Gate 定义。
- `docs/WORKFLOW-GUIDE.md`：七阶段教学流程。

## 观察步骤

1. 在 workflow catalog 记录 Concept 到 Release 的七个阶段和 `next_phase`。
2. 找出一个 Gate 的输入、参与角色和报告结果。
3. 对照 workflow 和 review mode，查看 minimal、standard/full 路径差异。
4. 检查 catalog 对 Gate verdict 与阶段推进的说明。

## 观察结果

catalog 定义阶段步骤和可检查产物；`/gate-check` 汇总审查结果。Gate 报告帮助用户作决定，catalog 明确其 verdict 是 advisory，不能误说成系统自动锁死推进。

## 简化说明

每个阶段有自己的证据和特定 Gate。本课只建立流程图，不对任何实际项目给出通过或失败结论。

## 自测

画出一次 Pre-Production → Production 的检查链，并标出哪些是产物条件、哪些是评审建议、谁作最终推进决定。
