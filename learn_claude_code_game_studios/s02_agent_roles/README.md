# 第 2 课：Agent 角色与责任边界

**目标：** 从 Agent 定义中找出其领域、职责、委派关系和模型设置，理解“49 个角色”如何分层。

## 源码位置

- `engine/Claude-Code-Game-Studios/.claude/docs/agent-roster.md`：角色索引。
- `.claude/agents/directors/`、`leads/`、`specialists/`、`engine/`、`operations/`、`qa/`：角色定义。
- `.claude/agents/directors/creative-director.md`：负责人定义样例。
- `.claude/docs/model-tiers.md`：模型设置说明。

## 观察步骤

1. 在 roster 中分别选一个 director、department lead 和 specialist。
2. 打开其定义，记录 frontmatter、负责范围、输入和不能单方面决定的事项。
3. 比较 `.claude/agents/engine/` 中 Godot、Unity、Unreal 的专项角色。
4. 用 `model-tiers.md` 对照 `model:` 字段，区分固定模型和继承会话模型。

## 观察结果

Agent 是按职责委派的专业角色。层级表示协调与升级关系，不代表所有任务都要经过每一层；模型设定也需要按 Agent 定义与模型规则读取，不能只从角色名字推断。

## 简化说明

角色文件只是可执行提示的静态定义。它本身不能证明 Claude Code 选中了该角色，或子代理交付的结果正确。

## 自测

给“评审跨部门战斗系统设计”选择一个协调角色和至少两个 specialist，并说明冲突应向谁升级。
