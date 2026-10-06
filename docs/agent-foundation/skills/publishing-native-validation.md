# 阶段 10 候选 skill 与验证记录

状态：阶段 10 在 Web 预览与 Mac 已发布包的本轮切口已收口。两份候选 skill 已完成 Mac 正常启动与“有 `window` 仍非浏览器”误诊试用，尚未安装；正式 Web 发布、小游戏及移动端须另立目标平台验证。

| 任务 | 2.4.15 | 3.8.7 |
| --- | --- | --- |
| 独立笔记 | [2.x](../../2.x/10-publishing-and-native.md) | [3.x](../../3.x/10-publishing-and-native.md) |
| 候选 skill | [2.4 发布/原生追踪](cocos2-publishing-native-trace/SKILL.md) | [3.8 发布/原生追踪](cocos3-publishing-native-trace/SKILL.md) |
| Mac 正常案例 | [原生轨迹](../traces/2.4.15-stage10-mac-native-startup.jsonl)覆盖 `boot` 到场景启动后首次 `AFTER_DRAW`。 | [原生轨迹](../traces/3.8.7-stage10-mac-native-startup.jsonl)覆盖 SystemJS、适配器、初始化委托到场景启动后首次 `AFTER_DRAW`。 |
| 易混淆案例 | 原生适配器也提供 `window`；`CC_JSB` 在构建/非构建路径来源不同。 | `sys` API 相同而 `pal` 实现不同；`application.js` 是生成快照，初始化委托不等于第一帧。 |
| 引擎来源 | `local/builder.json`/`settings/builder.json` 未给出来源，仍待编辑器配置与构建日志确认。 | `build/mac/cocos.compile.config.json` 明确为 Creator 安装目录的内置 TS/Native 引擎；不是邻接源码。 |
| 缺口 | 正式 Web 发布包、小游戏宿主与 2.4 包引擎来源。 | 正式 Web 发布包、小游戏宿主和 JSB 对象所有权；现有 Mac 包不是邻接引擎。 |

2026-10-04 对现有 Mac 包做了[只读启动冒烟记录](../traces/stage10-mac-native-startup-smoke.jsonl)：2.4 在 12 秒内输出了 V8 初始化与 `Cocos Creator v2.4.15`；3.8 进程持续运行到观察超时，stdout/stderr 为空。它们没有给出脚本事件/首帧顺序，不能代替下面的对照探针。默认命令沙箱阻断 2.4 的 GUI 初始化；上面的有效观察使用了可访问 GUI 的执行环境。

随后用[2.4 可复跑探针](../probes/stage10-mac-startup-2.4.py)及[3.8 可复跑探针](../probes/stage10-mac-startup-3.8.py)获得两份 Mac 原生轨迹，均区分场景前首次 `AFTER_DRAW` 与场景后首次 `AFTER_DRAW`，并证实原生包中 `window/document` 存在而 `isBrowser=false`。3.8 先经进程调用栈确认 `Engine::tick → EventDispatcher::dispatchTickEvent`，再以应用可写目录记录事件；最初写 `/private/tmp` 的探针没有产物，不列为通过。两包临时生成文件均已逐字节恢复，3.8 应用可写目录的临时事件文件已清理。

Web 一侧已复用阶段 1 同场景预览轨迹，比较见[对照](../../comparisons/10-publishing-and-native.md)。正式 Web 发布包、小游戏宿主、其他原生平台与自定义引擎重新构建仍需各自验证；这些不是本次 Mac 诊断 skill 的已通过案例。若后续要安装 skill，先依据 agent 的运行环境确定目录和触发方式。
