# 阶段 12：3.8.7 编辑器扩展与工程诊断

## 官网基线和源码覆盖

3.8 手册以项目 `extensions/` 建扩展，[扩展定义](https://docs.cocos.com/creator/3.8/manual/zh/editor/extension/define.html)使用 `package_version: 2`、`main`、`contributions`；[创建扩展](https://docs.cocos.com/creator/3.8/manual/zh/editor/extension/create-extension.html)给出模板与 TypeScript 编译。 [构建扩展](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/custom-build-plugin.html)的 `builder`/`hooks` 在独立构建进程执行，和扩展主进程消息是不同边界。[项目构建模板](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/custom-project-build-template.html)支持目标平台目录覆盖、EJS/JSON 特殊处理。[定制引擎](https://docs.cocos.com/creator/3.8/manual/zh/advanced-topics/engine-customization.html)通过 Engine Manager 分别选择 TypeScript/Native 的 Built-in 或 Custom，并编译及重启编辑器。

`3.8.7engine/editor/inspector/assets/material-header.js::callMaterialPreviewFunction` 向 `scene` 进程请求 `call-preview-function`；`editor/exports/` 暴露部分引擎能力给编辑器。它们是可见的**编辑器集成点**，但本仓库没有 Creator 扩展管理器、构建扩展 worker 或完整构建面板的宿主源码。示例原先没有 `extensions/`；阶段 12 新增了 `extensions/stage12-editor-probe/`。`build-templates/` 仍不存在，因此模板覆盖和构建 worker 钩子尚无运行案例。

## 引擎编译链与已发布包来源

`3.8.7engine/package.json` 中 `build:dev` 调 `scripts/build-h5-source.js`；该脚本调用 `@cocos/ccbuild.buildEngine`，`engine` 参数指向邻接引擎根目录，输出 `bin/dev/cc`。`npm test` 为 `tsc --noEmit && jest`。这两者分别是源码构建和源码测试，**不会自行切换示例 Creator 的引擎选择**。

示例现有 `build/mac/cocos.compile.config.json` 记录 `engineInfo.typescript.type` 与 `engineInfo.native.type` 均为 `builtin`，相应 `path` 指向 `/Applications/Cocos/Creator/3.8.7/.../engine` 及其 `native`，`buildEngineParam.entry` 与 `cocosParams.enginePath/nativeEnginePath` 也指向安装目录。[只读轨迹](../agent-foundation/traces/stage12-engine-provenance.jsonl)再次解析了两条 `engineInfo` 路径，并与邻接 `3.8.7engine/` 比较，结果均为 `uses_adjacent_source=false`。因此**这个现有 Mac 构建**没有使用邻接源码。构建配置是该次构建的生成快照，不证明当前编辑器设置仍相同，也不推断之后新构建的来源。[阶段 10 笔记](10-publishing-and-native.md)另记录了现有包启动轨迹。

## 小型构建问题：邻接源码改动为何不出现在 Mac 包

开发者修改 `3.8.7engine/cocos/` 后直接运行现有 `3.8,7NewProject/build/mac/`，若看不到变化，先以官网 Engine Manager 的 TS/Native 分开选择为基准，读取**同一目标、同一次构建**的 `cocos.compile.config.json`，核对 `engineInfo`、`buildEngineParam.entry` 与 `cocosParams`。这里三处均回到 Creator 安装目录，问题的当前定位是**构建来源未切到邻接引擎**。若要验证修复，应在 Engine Manager 选择对应 Custom 路径、按官网编译和重启、重新构建 Mac，再复查新配置和一个可识别的代码标记；本阶段没有执行这些会改变项目设置与产物的步骤。

一般扩展故障先确定 `extensions/<name>/package.json` 的入口和 `contributions`，再按扩展主进程、面板进程、构建 worker 追消息或 hook。[扩展运行轨迹](../agent-foundation/traces/stage12-editor-extension.jsonl)记录了在 3.8.7 扩展管理器刷新后发现该包、启用成功、项目日志出现 `[STAGE12_3] load`；点击 `Develop → Stage 12 Probe` 后，控制台与 `temp/logs/project.log` 又出现 `[STAGE12_3] ping`。这验证了当前 3.8.7 宿主的项目扩展注册、主入口加载与菜单消息分发，不覆盖面板或构建 worker。构建模板问题先查源目录 `build-templates/[platform]` 和目标包复制结果；当前示例没有模板源文件。

本例的可观察链为：项目 `extensions/stage12-editor-probe/package.json::contributions.menu` 指向 `ping`，`contributions.messages.ping.methods` 指向主入口方法 → Creator 3.8.7 扩展管理器注册/启用 → `dist/main.js::load` 日志 → 点击 `Develop` 菜单 → `dist/main.js::methods.ping` 日志。扩展管理器与消息总线的逐函数实现不在本仓库，不从此观察推断内部调度时序。

## 调试与性能：两个 Profiler 层级

`cocos/profiler/profiler.ts::showStats` 把游戏内统计接到 Director 的更新、物理、渲染事件和 GFX 设备计数；`cocos/core/platform/debug.ts::setDisplayStats` 在本快照已标记弃用并委托给该对象。官网的[3.8 原生 Profiler](https://docs.cocos.com/creator/3.8/manual/zh/advanced-topics/profiler.html)是更详细的 **Native C++** 统计，需要项目开启调试文字渲染器、`native/cocos/base/Config.h` 中 `CC_USE_PROFILER=1`，再重新编译原生目标；不能用游戏内 FPS 覆盖层证明 C++ 内存或调用块数据。

本快照 `native/cocos/profiler/Profiler.h::CC_PROFILE_OBJECT_INC` 原来把 `CC_PROFILER` 误写为 `C_PROFILER`。用[最小编译探针](../agent-foundation/probes/stage12-profiler-object-inc.cpp)在 Mac 条件和 `CC_USE_PROFILER=1` 下调用该宏，Clang 原先报 `undeclared identifier 'C_PROFILER'`；修正一个标识符后，同一语法编译在宏开启、关闭两种状态均通过，记录见[编译轨迹](../agent-foundation/traces/stage12-profiler-macro.jsonl)。仓库现有其他 C++ 文件未调用该增量宏，所以普通引擎构建可能不会暴露此错；本次验证也不等于完整原生构建或性能测量。

本阶段尚未运行 `npm test`、构建 worker、构建模板、自定义引擎重新发布或原生 Profiler UI；完整宿主时序和实际性能数据仍待聚焦实验。
