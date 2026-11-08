# 第 1 课：会话入口与上下文装配

**目标：** 追踪 Claude Code 从项目根目录启动时会获得哪些说明，以及哪些资料只在需要时读取。

## 源码位置

- `engine/Claude-Code-Game-Studios/CLAUDE.md`：主上下文和 `@` 导入。
- `engine/Claude-Code-Game-Studios/.claude/docs/coordination-rules.md`：协作与委派规则。
- `engine/Claude-Code-Game-Studios/.claude/docs/context-management.md`：上下文管理参考。
- `engine/Claude-Code-Game-Studios/.claude/settings.json`：会话启动和工具事件配置。

## 观察步骤

1. 顺着 `CLAUDE.md` 中的 `@...` 路径打开被导入的资料。
2. 找出只被标记为“按需读取”的文档。
3. 对照 `settings.json` 的 `SessionStart`、`PreToolUse` 和 `Stop` 事件。
4. 比较从项目根目录与从 `src/` 子目录启动时，项目级配置是否会加载。

## 观察结果

`CLAUDE.md` 是入口，不是全部知识的副本：少量高优先级约定被直接导入，详细参考资料留在文件中按任务读取；Hooks 则由设置文件按事件注册。README 明确要求从含 `CLAUDE.md` 和 `project.yaml` 的项目根目录启动，否则项目 Hooks、拒绝规则和询问模式可能不加载。

## 简化说明

这里只读静态配置。文件列出了配置意图，但要证明 Claude Code 某次会话实际加载了哪份指令，需要观察该版本的运行状态或启用诊断日志。

## 自测

画一条“会话启动 → CLAUDE.md → 导入文件 / 按需参考 → settings.json 事件”的路径，并标出哪个环节会在每次工具调用时触发。
