---
name: cocos3-editor-extension-message
description: Diagnose a Cocos Creator 3.8 project extension whose menu command does not reach its main-process handler. Use for extensions/ package registration, enablement, load, and menu message issues; exclude build worker hooks and game runtime input.
---

# Creator 3.8 编辑器扩展菜单消息诊断

先核对 [3.8 官网扩展定义](https://docs.cocos.com/creator/3.8/manual/zh/editor/extension/define.html) 和 [菜单扩展](https://docs.cocos.com/creator/3.8/manual/zh/editor/extension/first.html)。本仓库的可复测案例在 `3.8,7NewProject/extensions/stage12-editor-probe/`；[运行轨迹](../../traces/stage12-editor-extension.jsonl)已观察到管理器注册和启用、`load`、点击菜单后的 `ping`。

对目标项目按层定位：

1. 检查 `extensions/<name>/package.json` 的 `package_version: 2`、`main` 文件路径、`contributions.menu` 的 `path/label/message`，以及 `contributions.messages[message].methods` 是否对应主入口 `exports.methods` 中的方法。
2. 在该版本 Creator 扩展管理器中确认项目扩展已发现、已启用；查该次项目日志的注册/启用错误。文件存在本身不等于扩展已加载。
3. 在主入口的 `load` 和消息方法分别加入可识别日志。先确认 `load`，再实际点击对应菜单并确认方法日志。只出现菜单或 `load` 都不能证明消息已送达。
4. 若前述链路成立，而问题发生在构建时，转查构建扩展的独立 `builder`/`hooks` worker；不要用主进程 `ping` 的结果解释 worker 内部时序。

报告时给出 Creator 补丁版本、项目路径、扩展配置键、实际日志/菜单观察，以及结论停止在哪一层。3.8.7 引擎源码不包含完整 Creator 扩展宿主；宿主内部调度若无实际日志，只能标为待验证。
