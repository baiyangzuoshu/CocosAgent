# 阶段 12：编辑器扩展与工程诊断对照

先读[2.4 独立笔记](../2.x/12-editor-extension-and-diagnostics.md)与[3.8 独立笔记](../3.x/12-editor-extension-and-diagnostics.md)。下表比较同一开发动作的公开入口和本仓库可核查的实现边界。

| 开发动作 | 2.4.15 | 3.8.7 |
| --- | --- | --- |
| 给项目加一个编辑器扩展 | [官网](https://docs.cocos.com/creator/2.4/manual/zh/extension/your-first-extension.html)用 `packages/`、`main-menu`、主入口与 IPC；示例完整重开后在 Package Manager 中出现，点击 `Packages` 菜单后观察到 `ping`。初次 `load` 日志未留存。引擎仓库只有如 Spine 资产导入的集成点，缺扩展宿主。 | [官网](https://docs.cocos.com/creator/3.8/manual/zh/editor/extension/define.html)用 `extensions/`、`package_version: 2`、`contributions` 与消息；示例探针经管理器刷新、启用后出现 `load`，点击 `Develop` 菜单后观察到 `ping`。引擎仓库的 Inspector 消息调用不等于扩展宿主。 |
| 在构建时加自定义文件或动作 | [官网](https://docs.cocos.com/creator/2.4/manual/zh/publish/custom-project-build-template.html)给出 `build-templates/[platform]` 与 `Editor.Builder` 事件；本示例无模板/构建插件。 | [官网模板](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/custom-project-build-template.html)与[构建扩展](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/custom-build-plugin.html)分开，后者有 `builder` 和独立 worker hooks；本示例无模板/扩展。 |
| 改引擎后确认是否进入产物 | 官网要求项目选择自定义 JS 引擎并编译 `gulp` 产物；现有两份 builder 配置不含引擎路径，来源仍待编辑器或产物标记确认。 | Engine Manager 分别选择 TS/Native；现有 Mac 生成配置明确二者均为安装目录 `builtin`，所以这个包没有使用邻接源码。 |
| 测试与诊断 | 引擎 `npm test → gulp test-in-ci`，故障定位先判编辑器宿主还是 `cocos2d/`。 | 引擎 `npm test → tsc --noEmit && jest`，故障定位先判扩展主进程、构建 worker、TS/PAL 或 Native。 |
| 观察运行时帧统计 | `CCDebug.setDisplayStats → cc.profiler` 接 Director 更新/绘制事件；浏览器与原生调试入口按目标另选。 | `profiler.showStats` 接 Director/GFX 的游戏内统计；官网另有需开启 `CC_USE_PROFILER` 并重新编译的 Native C++ 统计。 |

## 同一问题的最小诊断结论

问题：“我改了邻接引擎源码，为什么现有 Mac 包没变化？” [来源探针](../agent-foundation/probes/stage12-engine-provenance.py)与[结果](../agent-foundation/traces/stage12-engine-provenance.jsonl)使 3.8 的这个**现有包**可判定为内置引擎构建；2.4 缺少来源字段，不能给出同等判定。这个对照检验的是**证据能证明什么**，不能把 3.8 的配置形状套到 2.4。两版都还需要在项目设置中配置对应自定义引擎，并以重新编译、重新构建及新产物标记来验证实际接线；本次未修改项目设置或构建产物。

面向未来 Cocos agent，先按版本和症状分流到扩展、项目构建或引擎运行时，再收集该目标的编辑器设置、构建日志和生成配置。`editor/` 代码是集成证据；宿主缺席时应停止于接口边界。候选流程与验证范围见[阶段 12 记录](../agent-foundation/skills/editor-extension-diagnostics-validation.md)。

[两版扩展轨迹](../agent-foundation/traces/stage12-editor-extension.jsonl)说明同样创建“菜单 → 扩展消息”时，2.4 的旧包入口和 3.8 的 `contributions` 配置不能互换。两边都已在各自编辑器实测菜单点击与 `ping`；2.4 新目录需完整重开项目才被这次宿主发现，3.8 在已运行编辑器中通过扩展管理器刷新、启用。这里是两个独立观察，不把“2.4 必须重开”推广为所有 2.4 扩展安装方式的规则。

阶段 12 的小型**源码故障**发生在 3.8 Native Profiler：开启[官网原生性能剖析器](https://docs.cocos.com/creator/3.8/manual/zh/advanced-topics/profiler.html)并调用 `CC_PROFILE_OBJECT_INC` 时，`Profiler.h` 中误写的 `C_PROFILER` 导致编译错误。修正后同一聚焦语法编译通过。2.4 运行时 FPS 覆盖层没有对应的 C++ 宏；此故障属于 3.8 专属实现，见[编译轨迹](../agent-foundation/traces/stage12-profiler-macro.jsonl)，不应强行建立同名 API 对照。

## 验收结论

当前阶段的三个可复核结果是：两版扩展各自完成“菜单点击 → 消息方法”运行闭环；现有 3.8 Mac 包的内置引擎来源可由生成配置确认，2.4 当前配置不足以判断来源；3.8 Native Profiler 宏缺陷由开启宏的编译探针复现并在修正后通过。对应的版本专属候选 skill、正常/易混淆试用和原始轨迹均已保存。构建 worker、模板、自定义引擎重建及真实性能数据须在相应开发任务中单独取证；2.4 扩展 `load/unload` 精确时点也未测得。这些待测项不作为上述已验收结论的证据。
