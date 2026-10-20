# 阶段 12：2.4.15 编辑器扩展与工程诊断

## 官网基线和源码覆盖

2.4 手册的[创建扩展包](https://docs.cocos.com/creator/2.4/manual/zh/extension/your-first-extension.html)把项目级扩展放在 `packages/`：`package.json` 的 `main` 指向扩展入口，`main-menu` 发消息给入口；[扩展面板](https://docs.cocos.com/creator/2.4/manual/zh/extension/extends-panel.html)还区分主进程与面板进程及 `Editor.Ipc`。 [定制引擎](https://docs.cocos.com/creator/2.4/manual/zh/advanced-topics/engine-customization.html)要求版本匹配，并在项目设置中选择自定义 JS 引擎路径；JS、Cocos2d-x 和适配器是不同修改面。[构建模板和构建插件](https://docs.cocos.com/creator/2.4/manual/zh/publish/custom-project-build-template.html)描述 `build-templates/[platform]` 覆盖与 `Editor.Builder` 的构建事件。

本工作区的 `2.4.15engine/` **不是完整 Creator 编辑器仓库**。`editor/i18n/` 提供引擎相关本地化；`extensions/spine/editor/spine-meta.js` 等文件通过 `Editor.metas['custom-asset']` 和 `Editor.assetdb` 接入编辑器资产系统。这说明仓库有编辑器集成代码，不能由此推断扩展包管理、面板宿主、`Editor.Builder` 或项目设置的内部实现。示例原先的 `packages/` 为空，阶段 12 已新增 `packages/stage12-editor-probe/`；`build-templates/` 仍不存在。

## 引擎编译链与构建来源

本地引擎 `gulpfile.js` 的 `build-html5-preview` 调 `Engine.buildPreview`，`build-dev` 组合清缓存、HTML5/JSB 预览编译；`build` 组合预览与 JSB 编译。`gulp/tasks/engine.js` 负责这些引擎文件的打包。这条链只说明**如何从此源码生成引擎脚本**，不代表示例的 Creator 项目构建已经选用了它，也不等于 `Editor.Builder` 的项目构建钩子。修改 `cocos2d/` 后需先编译引擎、在对应 Creator 项目设置中指向生成的自定义引擎，再以预览或发布产物核对代码来源。

[只读来源轨迹](../agent-foundation/traces/stage12-engine-provenance.jsonl)读取了示例的 `local/builder.json`、`settings/builder.json`：两者均无引擎路径字段。这只证明**从这两份配置无法确定**当前 2.4 Mac 包或预览选用了哪个引擎，不能推断它必然为内置或邻接源码。下一步若要验证 2.4 源码改动，需要编辑器项目设置、自定义引擎指向、构建日志或产物中的可识别标记，且针对实际目标重新构建。阶段 10 的[发布与原生笔记](10-publishing-and-native.md)保留已有包的启动链路证据。

## 面向游戏开发者的诊断流程

1. 先分类症状：编辑器菜单/面板、资源导入、引擎运行行为、项目构建钩子、构建模板或目标平台。按上面的对应手册页确定公开入口。
2. 若是资源导入问题，从 `extensions/*/editor/*-meta.js` 的 `Editor.metas`/`Editor.assetdb` 接口追到资产与 `.meta`；具体编辑器宿主调用顺序在本仓库外，需用 Creator 日志或受控扩展验证。
3. 若是引擎行为问题，定位 `cocos2d/` 源符号和相关 `test/`，再查 `gulpfile.js` 对应产物。验证时先记录 Creator 版本、项目设置中的引擎路径、编译命令、构建目标与生成文件哈希；否则“改源码后无效”不能归因于实现错误。
4. 若是构建模板或扩展包问题，检查项目 `build-templates/` 或 `packages/` 源文件及实际目标平台；阶段 12 的扩展仅含 `load/unload/ping` 诊断入口，不参与构建。不要把 `build/`、`library/` 中的生成文件当作修复入口。

`npm test` 在本地引擎中调用 `gulp test-in-ci`；需要先确定依赖和聚焦范围。[扩展轨迹](../agent-foundation/traces/stage12-editor-extension.jsonl)记录了探针文件通过本地语法检查。由于编辑器在创建文件前已经启动，Package Manager 起初没有该包，“重新加载界面”也没有使它出现；完整重开项目后，Package Manager 列出 `stage12-editor-probe`。点击新出现的 `Packages → Stage 12 Probe`，控制台打印 `[STAGE12_2] ping`，确认本次 2.4.15 宿主的项目包发现与菜单消息分发。初次启动的 `[STAGE12_2] load` 未留在可见控制台，故单独的 `load` 日志时点未取证。安装目录自带的 `builtin/package-manager/panel/package-manager.js`（本仓库外）显示该面板查询 `Editor.Package.queryInfos`，并可对已加载包调用 `Editor.Package.reload`；本次也点击了探针的 Reload，但该操作后的 `unload/load` 日志尚未观察到。

本例的可观察链为：项目 `packages/stage12-editor-probe/package.json::main-menu` 提供 `Packages/Stage 12 Probe` 和消息名 → Creator 2.4.15 实际菜单项 → 点击后的 `main.js::messages.ping` → 控制台标记。菜单注册与消息传递的宿主内部函数不在本仓库，不能由这条轨迹补出逐函数时序。

## 调试与性能边界

[2.4 项目预览调试](https://docs.cocos.com/creator/2.4/manual/zh/editor/preview/)把浏览器 DevTools、Show FPS 和模拟器区分为不同观察面；[原生 JS 调试](https://docs.cocos.com/creator/2.4/manual/zh/publish/debug-jsb.html)另要求目标原生进程的远程调试。引擎的 `cocos2d/core/CCDebug.js::setDisplayStats` 在非 Canvas 渲染时转给 `cc.profiler.showStats/hideStats`；`cocos2d/core/utils/profiler/CCProfiler.js` 以 Director 的更新、绘制事件累计游戏内统计。这是**运行时覆盖层**，不是扩展主进程日志或原生 C++ 内存剖析。

本阶段没有测量 FPS、内存或原生调用耗时，也没有运行完整引擎测试；诊断环境应记录预览/发布目标、浏览器或原生调试连接及是否显示统计，再分析具体故障。
