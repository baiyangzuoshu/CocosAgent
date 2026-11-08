# 第 11 课：引擎参考资料

**目标：** 找到项目所用引擎和版本对应的参考资料，并理解为什么不能只依赖模型记忆。

## 源码位置

- `engine/Claude-Code-Game-Studios/docs/engine-reference/README.md`：资料结构和使用方法。
- `docs/engine-reference/godot/VERSION.md`、`unity/VERSION.md`、`unreal/VERSION.md`：版本边界。
- 各引擎目录中的 `current-best-practices.md`、`deprecated-apis.md`、`breaking-changes.md` 和 `modules/`。
- 根级 `CLAUDE.md` 的 Engine Version Reference 导入。

## 观察步骤

1. 检查 `project.yaml` 的 engine 字段和当前版本。
2. 找到该引擎的 `VERSION.md`，记录资料覆盖的版本。
3. 选择一个模块（如 UI 或网络），对照 best practices 和 deprecated API。
4. 观察 `/setup-engine` 如何把根级版本导入改为所选引擎。

## 观察结果

引擎参考资料是版本化的查阅材料。项目做 API 决策前先核对当前版本资料；版本变更后也要检查 breaking changes，避免把不同补丁版或引擎的结论混用。

## 实践

模板尚未选定引擎时，先并排打开三个引擎目录的 `VERSION.md`，任选一个 API 建议去 `current-best-practices.md` 和 `breaking-changes.md` 中核对。完成第 12 课的 `/setup-engine` 后，再确认根级 `CLAUDE.md` 引入的是哪个版本参考。

## 简化说明

本课只比较文档，不运行 Godot、Unity 或 Unreal。它们不是 Cocos Creator 的参考资料，不能用于推断 Creator API。

## 自测

给一个 API 使用建议标出引擎、版本、参考文档和适用限制；若项目尚未选择引擎，应如何处理？
