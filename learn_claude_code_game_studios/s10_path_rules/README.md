# 第 10 课：按路径加载的 Rules

**目标：** 理解 Rule 的路径匹配、生效时机，以及它与自动 Hook 校验的差别。

## 源码位置

- `engine/Claude-Code-Game-Studios/.claude/rules/`：路径约束定义。
- `.claude/docs/rules-reference.md`：加载规则和匹配范围。
- `.claude/rules/gameplay-code.md`、`scene-files.md`：示例规则。
- `.claude/settings.json`：二进制 Unreal 文件的编辑拒绝规则。

## 观察步骤

1. 打开一条 Rule，记录 frontmatter 的 `paths` glob。
2. 用 `rules-reference.md` 检查它在读文件还是写文件时加载。
3. 判断规则内容是模型上下文指导，还是由 Hook/permission 真正拦截。
4. 对比一个路径级 Rule 和一个二进制文件 deny 规则。

## 观察结果

带 `paths:` 的规则在读取匹配文件时加载；它们是上下文指导，不是编译器或沙箱强制校验。必须无条件成立的检查应由相应 Hook 或权限规则承担。

## 实践

在副本里新建 `src/gameplay/rule-probe.gd`，写入一条简单的 `extends Node` 声明，再让 Claude Code 读取并解释这个文件。记录加载到的 gameplay 编码指导；接着创建同样内容的 `src/misc/rule-probe.gd`，比较两次上下文。Rule 在读取时加载，不是在创建时自动执行校验。

## 简化说明

具体 glob 行为可能受 Claude Code 版本影响。课程只按仓库记载的路径和版本讨论，不推断其他客户端实现。

## 自测

新建 `src/gameplay/new_system.gd` 时，如果没有读取同目录现存文件，`gameplay-code.md` 会不会自动出现？用规则文档说明答案。
