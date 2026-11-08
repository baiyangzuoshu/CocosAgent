# 第 12 课：首次启动与项目识别

**目标：** 理解 `/start` 如何识别项目阶段，并把用户带到匹配的入门路线。

## 源码位置

- `engine/Claude-Code-Game-Studios/.claude/skills/start/SKILL.md`：引导入口。
- `.claude/skills/setup-engine/SKILL.md`：选择引擎和版本。
- `.claude/skills/project-stage-detect/SKILL.md`：现有工程诊断。
- `.claude/skills/help/SKILL.md`、`.claude/docs/workflow-catalog.yaml`：后续导航。

## 观察步骤

1. 从 `/start` 中找出“无概念、模糊概念、明确概念、现有工程”的分支。
2. 追踪每种情况会转向哪个 Skill。
3. 对照 minimal 与 standard/full 路线，记录各自所需的首批产物。
4. 看 `/help` 如何结合阶段和已存在的文件提供下一步。

## 观察结果

`/start` 是路线选择器，不是固定向所有项目套用的长流程。新项目可从 engine setup 和一页 brief 开始；已有代码则先识别当前阶段，再考虑 adopt。

## 实践

在尚未配置概念的隔离副本中运行 `/start`，按实际提示选择“无想法”或“已有想法”，跟随它调用的 Skill。观察 `/setup-engine` 和 `/brainstorm` 后产生的文件；确认保存前，核对它给出的路径和内容摘要。

## 简化说明

路由条件从 Skill 文本核对；`/start` 只在隔离副本中执行，保存前由学习者确认它将写入的文件。

## 自测

为“已有 Unity 工程、没有设计文档”的情况指出下一步诊断入口，并说出为什么不应直接假设它处在某个生产阶段。
