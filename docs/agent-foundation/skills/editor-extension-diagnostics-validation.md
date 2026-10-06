# 阶段 12：工程诊断候选 skill 验证

本阶段的可复用任务是“判断源码改动是否进入指定 Creator 构建，并在证据不足时指出下一步”。两版各有候选 skill：[2.4 来源诊断](cocos2-engine-build-provenance/SKILL.md)、[3.8 来源诊断](cocos3-engine-build-provenance/SKILL.md)。两版最小扩展的菜单消息均已实测，分别形成[2.4 包菜单诊断](cocos2-editor-package-message/SKILL.md)与[3.8 扩展菜单诊断](cocos3-editor-extension-message/SKILL.md)；宿主源码仍在工作区外，不把两套扩展配置合并成跨版本执行链 skill。

| 检查 | 2.4.15 | 3.8.7 |
| --- | --- | --- |
| 官网基线 | [引擎定制](https://docs.cocos.com/creator/2.4/manual/zh/advanced-topics/engine-customization.html)与[扩展包](https://docs.cocos.com/creator/2.4/manual/zh/extension/your-first-extension.html) | [引擎定制](https://docs.cocos.com/creator/3.8/manual/zh/advanced-topics/engine-customization.html)与[构建扩展](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/custom-build-plugin.html) |
| 正常案例 | 引擎 `gulpfile.js::build-dev` 可定位到预览引擎编译任务；属于源码构建证据。 | 本次 Mac `cocos.compile.config.json` 的 TS/Native `builtin` 路径均可解析，并与邻接源码路径不相同；属于已生成包的来源证据。 |
| 易混淆案例 | `local/builder.json` 与 `settings/builder.json` 无引擎路径：正确输出“未知”，不能猜内置或自定义。 | `scripts/build-h5-source.js` 指向邻接源码，但这是引擎仓库自构建脚本，不能覆盖 Mac 包的 `builtin` 记录。 |
| 执行证据 | [只读探针与 JSONL](../traces/stage12-engine-provenance.jsonl)，未启动 Creator。 | 同一轨迹，并交叉核对 `buildEngineParam.entry`、`cocosParams.enginePath/nativeEnginePath`。 |
| 扩展探针 | `packages/stage12-editor-probe` 在完整重开后出现于 Package Manager；点击 `Packages → Stage 12 Probe` 后控制台出现 `ping`。初次 `load` 和 Reload 后的 `unload/load` 日志未观察到。 | `extensions/stage12-editor-probe` 经管理器刷新、启用，项目日志先后出现 `load`、点击 `Develop → Stage 12 Probe` 后的 `ping`。 |
| 尚未验证 | 编辑器项目设置、构建日志、自定义引擎实际加载、扩展生命周期日志时序、模板执行。 | Engine Manager 改为 Custom 后重新编译和发布、扩展面板/构建 worker/模板运行、实际性能数据。 |

试用结果：两版流程均先要求识别**目标构建**及其来源证据，不把邻接源码的存在当作已接线。3.8 对现有 Mac 包可得确定结论；2.4 给出证据不足和具体补证步骤。[扩展 UI/日志轨迹](../traces/stage12-editor-extension.jsonl)按各版独立记录：两版菜单 `ping` 已实测；3.8 有独立 `load` 日志，2.4 仅凭包列表与消息成功判断当前扩展可用，不补写未见到的生命周期时点。

3.8 还完成了一个具体的 Native Profiler 小故障：[官网](https://docs.cocos.com/creator/3.8/manual/zh/advanced-topics/profiler.html)要求开启 `CC_USE_PROFILER`，[编译探针](../probes/stage12-profiler-object-inc.cpp)在原源码下触发 `CC_PROFILE_OBJECT_INC` 宏拼写错误，修正 `Profiler.h` 后在开启/关闭两种状态均通过 Clang 语法编译。见[前后轨迹](../traces/stage12-profiler-macro.jsonl)及[3.8 专属候选诊断 skill](cocos3-native-profiler-diagnostic/SKILL.md)。此验证比静态检索更强，但不涵盖完整 Native 构建、链接或屏幕统计。没有运行完整引擎测试；后续调试与性能调查需绑定实际目标平台。

3.8 扩展菜单 skill 的正常案例是本项目探针：`package.json` 将 `contributions.menu[].message=ping` 映射到 `contributions.messages.ping.methods=[ping]`，管理器注册/启用和 `load` 可见，实际点击菜单后 `temp/logs/project.log` 在 2026-10-4 19:14:13 记录 `[STAGE12_3] ping`。易混淆案例是点击前只有菜单和 `load`：那时只能判定注册与入口加载，不能声称消息方法已执行。这个试用使 skill 明确要求按“发现 → 启用 → load → 实际菜单点击 → 方法日志”分层报告；2.4 的 `packages/` 不适用此 skill。

2.4 包菜单 skill 的正常案例也是当前项目：创建文件时编辑器已运行，首次包管理列表没有探针；完整重开工程后列表出现 `stage12-editor-probe`，点击 `Packages → Stage 12 Probe`，控制台出现 `[STAGE12_2] ping`。易混淆案例是“重新加载界面”后扩展菜单仍为空，不能把刷新界面写成包已被发现；另一个边界是消息成功不提供 `load/unload` 的精确时点。skill 因此要求分开观察包发现、菜单与消息日志，并在生命周期调查中另取日志。
