---
name: cocos2-editor-package-message
description: Diagnose a Cocos Creator 2.4 project extension whose Packages menu command does not reach its main entry. Use for packages/ discovery, main-menu messages, and Editor.Ipc handler issues; exclude game runtime events and 3.x extensions/ format.
---

# Creator 2.4 扩展包菜单消息诊断

先核对 [2.4 官网创建扩展包](https://docs.cocos.com/creator/2.4/manual/zh/extension/your-first-extension.html)。本仓库曾在 `2.4.15NewProject/packages/stage12-editor-probe/` 验证此流程；示例工程现已删除，[运行轨迹](../../traces/stage12-editor-extension.jsonl)仅作为历史证据。重新验收时需使用当前可用的 Creator 2.4.15 工程。

按当前工程逐层检查：

1. 检查 `packages/<name>/package.json` 的 `name`、`main` 和 `main-menu`；菜单项的 `message` 应与主入口 `module.exports.messages` 中的方法对应，消息前缀与包名一致。
2. 核对相同版本 Creator 的 Package Manager 已加载列表。新增目录若创建于编辑器运行期间，界面重载未必触发包发现；本示例直到完整重开项目才出现。不要把这次观察推广为其他安装方式的固定规则。
3. 实际点击 `Packages` 下的目标菜单，确认编辑器控制台的消息方法日志。包出现在列表与菜单出现只说明前两层，不证明消息执行。
4. 若要诊断 `load/unload` 时序，单独采集可保留的生命周期日志。当前示例的初次 `load` 及 Reload 后日志未保留，不要从 `ping` 的成功推导精确回调时点。

报告 Creator 补丁版本、项目路径、包配置、Package Manager/菜单/控制台的各层结果。`engine/2.4.15engine/` 缺完整编辑器包宿主源码；未在当前宿主观察的内部 IPC 顺序应保持待验证。
