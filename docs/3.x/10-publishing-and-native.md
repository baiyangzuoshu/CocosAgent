# 阶段 10：3.8.7 发布与原生

状态：官网基线、源码链和现有 Mac 包的启动/首次绘制事件轨迹已建立；Web 一侧使用阶段 1 的同场景预览轨迹，正式 Web 发布包与小游戏仍待验证。

## 官网基线与范围

- [3.8 构建面板](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/build-panel.html)、[构建选项](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/build-options.html)、[Web 发布](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-web.html)、[原生发布](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/native-options.html)、[小游戏发布](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-mini-game.html)分别描述编辑器工作流和目标产物。
- [原生开发概览](https://docs.cocos.com/creator/3.8/manual/zh/native/overview.html)与[纯 JS/绑定对象差异](https://docs.cocos.com/creator/3.8/manual/zh/advanced-topics/jsb-web-difference.html)约束原生扩展。官网未承诺本项目每个内部启动回调的绝对时间。

## 本仓库的分层地图

| 层 | 证据与职责 |
| --- | --- |
| 公开系统接口 | `3.8.7engine/cocos/core/platform/sys.ts` 把 `pal/system-info` 暴露为 `sys`；`cocos/game/game.ts` 使用 `pal/env`、`pal/pacer`、`pal/system-info`。 |
| 平台实现选择 | `3.8.7engine/cc.config.json` 的 `overrides` 以 `context.buildTimeConstants.HTML5/NATIVE/MINIGAME/RUNTIME_BASED` 选择 `pal/system-info`、`pal/env`、`pal/pacer` 等目标实现；小游戏的 `pal/minigame` 还按 `context.platform` 选具体宿主。 |
| 平台实现 | `pal/system-info/{web,native,minigame}/system-info.ts` 分别取浏览器、JSB 或小游戏宿主信息；`pal/env/{web,native,minigame}/env.ts` 分别处理 Canvas 与脚本加载。构建映射已选择模块，运行时不是一个实现文件里逐项切换。 |
| 适配器 | `platforms/native/builtin/index.js` 提供类浏览器全局与定时/帧回调；`platforms/native/engine/index.js` 挂接引擎原生适配。`scripts/build-adapter.js` 将两者分别打包成 `web-adapter.js`、`engine-adapter.js`，也为小游戏平台打包适配器。 |
| C++ 宿主 | `native/cocos/application/CocosApplication.cpp` 注册绑定并启动脚本引擎；`BaseGame.cpp` 接着运行 `jsb-adapter/web-adapter.js` 与 `main.js`。 |
| 项目构建产物 | `3.8,7NewProject/build/mac/data/main.js`、`application.js`、`src/settings.json` 是当前 Mac 快照。完整 Creator 构建器不在此引擎仓库；产物不能代表所有平台。 |

现有 `build/mac/cocos.compile.config.json` 的 `engineInfo.typescript` 和 `engineInfo.native` 都标为 `builtin`，路径指向 `/Applications/Cocos/Creator/3.8.7/.../engine`，构建日志也把该安装目录作为引擎入口。因此本 Mac 包**明确不是用邻接的 `3.8.7engine/` 构建**；它可用于观察 Creator 3.8.7 的已发布包，却不能直接验证邻接源码的改动。`data/main.js` 与 `.app/Contents/Resources/main.js` 当前 SHA-256 相同，证明所读入口对应这份应用资源快照。

## 同一项目的 Mac 原生启动链（静态）

`BaseGame::init` 调用 `CocosApplication::init` 建立绑定与 `ScriptEngine`，随后按序运行 `web-adapter.js` 和 `main.js`。生成的 `main.js` 加载 SystemJS、读 `import-map.json`，`System.import('./application.js')` 后导入 `cc`、加载 `jsb-adapter/engine-adapter.js`，再调用 `application.init(cc)` 与 `application.start()`。生成的 `Application` 注册 `onPostBaseInitDelegate` 和 `onPostSubsystemInitDelegate`，然后 `cc.game.init({settingsPath,...}).then(() => cc.game.run())`。`game.ts::init` 按 Promise 链先初始化 `sys`/settings，再初始化设备、资源管理器和子系统，之后项目资源；上述委托并非“游戏首帧”事件。

Web `SystemInfo` 从 `navigator`/UA 判定浏览器信息，Native `SystemInfo` 从 `__getPlatform` 等绑定函数和 `jsb.device` 获取信息，并把 `jsb.onPause/onResume/onClose` 转为 `hide/show/close`。`sys.ts` 对外代理相同属性，但两边来源与功能集合不同。Native `pal/env` 用宿主 Canvas 和 `require`，Web `pal/env` 查找 DOM Canvas 并插入 `<script>`；这解释同一 `loadJsFile` 调用的不同失败方式。

小游戏的 `pal/system-info/minigame/system-info.ts` 按 `internal:constants` 选平台并依赖小游戏宿主对象；该实现明确设置 `isNative=false`、`isBrowser=false`，再用 `minigame.getSystemInfoSync()` 填 OS、语言及能力。`pal/env/minigame/env.ts::loadJsFile` 对微信调用 `__wxRequire`，其他目标另有 `require` 分支；不能用 Web 的 `<script>` 或原生的普通 `require` 解释小游戏脚本加载。`scripts/build-adapter.js` 为各小游戏目标分别打包适配器，`templates/wechatgame/game.ejs` 等是引擎仓库提供的模板输入。没有对应项目构建包或宿主实测，上述均为源码覆盖。

## 帧驱动分叉（静态）

`game.ts::initPacer` 把 `Pacer.onTick` 绑定到 `_updateCallback`，目标帧率来自 `SettingsCategory.SCREEN`。Web `pacer-web.ts` 用浏览器 rAF 并按目标间隔筛帧，必要时回退到计时器；Native `pacer-native.ts` 直接用适配器的 rAF，改帧率时调用 `jsb.setPreferredFramesPerSecond`。原生适配器 `platforms/native/builtin/index.js` 保存 rAF 回调并导出 `gameTick`；C++ `Engine::run/tick` 广播 `events::Tick`，`EventDispatcher::dispatchTickEvent` 调用脚本全局的 `gameTick`，之后适配器运行到期回调，进入 `Pacer → Game._updateCallback → director.tick`。启动场景首次加载走 `_shouldLoadLaunchScene` 分支，不能把第一次 Pacer tick 等同于第一次 `director.tick`。下面的轨迹补足可观察事件顺序；显示器呈现时间与稳定帧率未量测。

脚本/原生协作可在本仓库追到一条完整调用：`pal/pacer/pacer-native.ts::targetFrameRate` 调 `jsb.setPreferredFramesPerSecond`；`native/cocos/bindings/manual/jsb_global.cpp` 将该名字注册到 JSB，并由 `JSB_setPreferredFramesPerSecond` 把参数转为 `int32_t` 后调用 `CC_CURRENT_ENGINE()->setPreferredFramesPerSecond`；`native/cocos/engine/Engine.cpp` 再调用 `BasePlatform::setFps` 并更新期望帧间隔。反向的平台识别由同一 `jsb_global.cpp` 的 `__getPlatform` 绑定读取 `BasePlatform::getOSType()`，Native `pal/system-info` 再映射成公开的 `Platform`。这一链是邻接 3.8.7 源码的实现说明；现有 Mac 包采用 Creator 内置同版本引擎，不能以它验证修改后的邻接 C++。

## 面向游戏开发者的诊断

跨平台问题先记录目标、构建宏、实际 `sys.platform` 与 `sys.hasFeature`，再追 `pal` 的所选实现、适配器和 C++ 绑定。原生对象的所有权与纯 JS 对象可能不同，检查绑定边界后再推断生命周期。生成的 `application.js` 可以解释当前包的初始化委托，但不等于所有 Creator 3.8 项目的固定模板。

## 已验证切口与待验证

1. 已在同一示例源场景取得 Web 预览与 Mac 已发布包的初始化、场景启动和首次绘制回调轨迹；两者构建条件不同，若需纯平台差异，另做正式 Web 发布包对照。
2. 若要验证邻接 `3.8.7engine` 的源码改动，须在编辑器设置自定义 TypeScript 与 Native 引擎并重新构建；现有包的配置已证明使用内置引擎。
3. 小游戏运行、JS/绑定对象所有权及各目标发布选项仍需分平台验证。

[Mac 启动冒烟记录](../agent-foundation/traces/stage10-mac-native-startup-smoke.jsonl)中标准输出为空；后来对运行中进程采样，确见 `Engine::tick → EventDispatcher::dispatchTickEvent`，说明没有停在 macOS 启动阶段。首次尝试写到 `/private/tmp` 没有产物；改用应用可写目录后，分别标记 `.app/Contents/Resources/main.js` 和构建目录 `data/main.js`，仅 `.app` 标记出现，确认实际入口。首次无产物符合应用容器的写入限制，不能从空 stdout 推断引擎未启动。

用[可复跑探针](../agent-foundation/probes/stage10-mac-startup-3.8.py)在发布 `.app` 的生成 `main.js` 与 `application.js` 临时打点，得到[原生启动轨迹](../agent-foundation/traces/3.8.7-stage10-mac-native-startup.jsonl)：`main-entry → SystemJS/application/engine-adapter → post-base-init → post-subsystem-init → engine-inited → game-inited → game.init resolved → first-after-draw → game.onStart/after-scene-launch → first-scene-after-draw`。`post-base-init` 时 `isNative=true`、`isBrowser=false`、`platform=MACOS`，同时 `window/document` 存在。首次绘制回调比场景启动早约 116 ms，对应源码中启动画面仍在运行的分支；场景启动后约 8 ms 才出现探针定义的首次场景绘制回调。事件不是显示器呈现时间，毫秒值只适用于这次包与机器。探针生成文件已逐字节恢复。
