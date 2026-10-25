# Cocos2d-x 4.0：应用启动与帧循环（本地源码静态追踪）

## 范围和证据状态

本文追踪本地 `engine/cocos2d-x-4/` 默认 C++ 模板的 macOS desktop 路径：`main.cpp` → `Application::run()` → `AppDelegate::applicationDidFinishLaunching()` → `Director::runWithScene()` → Director 帧循环。版本依据为该源码树 README/CHANGELOG 中的 4.0 标记。当前为静态源码追踪，没有构建或运行样例；不能作为实际窗口、首帧绘制、平台时序或帧率的验证证据。

## 启动路径

```text
templates/cpp-template-default/proj.ios_mac/mac/main.cpp
  → 创建栈上的 AppDelegate
  → Application::getInstance()->run()
  → macOS Application::run(): initGLContextAttrs()
  → AppDelegate::applicationDidFinishLaunching()
      → Director::getInstance()
      → 创建/设置 GLViewImpl
      → 设置帧间隔、设计分辨率和 contentScaleFactor
      → HelloWorld::createScene()
      → Director::runWithScene(scene)
  → macOS Application::run() 的窗口循环
      → Director::mainLoop()
      → GLView::pollEvents()
      → 按 animation interval 等待
```

证据入口：`templates/cpp-template-default/proj.ios_mac/mac/main.cpp:31-35`、`cocos/platform/mac/CCApplication-mac.mm:64-93`、`templates/cpp-template-default/Classes/AppDelegate.cpp:69-115`。

平台入口不是统一的 C++ `main()`：Android、iOS、Win32 和 Linux 各有平台启动代码。上面的 `main.cpp`/`Application::run()` 只代表模板 macOS desktop 分支；跨平台结论须逐一检查各平台的 Application glue。

## Director 的一次帧循环

在 `cocos/base/CCDirector.cpp:1378-1397`，`Director::mainLoop()` 处理待执行的 Director purge/restart；普通运行时调用 `drawScene()`，随后清空当前 autorelease pool。`mainLoop(float dt)` 则把外部传入的 dt 标记为调用方提供后转入同一主循环。

`drawScene()`（`CCDirector.cpp:248-315`）按源码大致执行：

1. renderer `beginFrame()`，计算 dt，并在存在 GLView 时轮询事件。
2. 未暂停时派发 `EVENT_BEFORE_UPDATE`、更新 Scheduler、派发 `EVENT_AFTER_UPDATE`。
3. 清理 renderer，派发 `EVENT_BEFORE_DRAW`，应用待切换场景。
4. 对运行中的 Scene 执行可选物理/导航更新，再通过 GLView 把 Scene 提交给 Renderer；派发 `EVENT_AFTER_VISIT`。
5. 完成统计信息、Renderer `render()` 和 `EVENT_AFTER_DRAW`。
6. `mainLoop()` 返回后清理当前 autorelease pool。

这是当前静态源码所示的调用顺序。某些功能分支受编译宏控制；事件发生时点、原生窗口行为以及实际是否绘制一帧仍应通过目标平台运行来确认。

## Scene 与 Node 的最小结构

模板 `HelloWorld::createScene()` 在 C++ 中创建 `Scene`、创建游戏 Layer 并以 `addChild` 建立父子关系；`AppDelegate` 将 Scene 传给 Director。`Node::addChildHelper()` 设置父节点、顺序与名称；当父节点正在运行时，会触发 child 的 `onEnter()` 和可能的 `onEnterTransitionDidFinish()`（`cocos/2d/CCNode.cpp:920-972`）。`Scene` 自身还会创建默认 Camera（`cocos/2d/CCScene.cpp`）。

对象创建/销毁需同时追踪 `Ref` retain count、autorelease pool、父子关系、Action/Scheduler 注册和 `cleanup`；仅看到节点从树上移除不足以判断 C++ 对象何时析构。

## 与 Creator 2.4.15 的起步对照

Creator 的独立启动分析和浏览器预览事件轨迹已存在于 [2.4.15 启动与帧循环](../2.x/01-startup-and-frame.md) 与 [startup trace](../agent-foundation/traces/2.4.15-preview-startup.jsonl)。该轨迹只覆盖 Creator 编辑器的 Chrome 图形预览。两边当前证据不是同一平台的同步实验。

- Cocos2d-x 默认 C++ 模板显式构造 GLView、分辨率配置和 Scene，并从平台 Application 循环驱动 Director。
- Creator 的浏览器预览由 Creator Editor 侧 `boot.js` 装配运行环境、加载项目脚本与场景；`cc.game.run()` 初始化 Creator JS runtime，`CCGame._runMainLoop()` 在非编辑器运行时用动画帧回调驱动 `cc.director.mainLoop(now)`。
- Creator 2.4.15 Web Director 在每帧运行组件 start/update、Scheduler、lateUpdate 和延迟销毁，再渲染场景。Cocos2d-x 的核心帧循环直接在 C++ Director 中更新 Scheduler、物理/导航分支和 Renderer；C++ 模板对象与 autorelease 生命周期属于同一运行时。
- Creator 编辑器工程与 Creator Editor 内部接线不完全包含于本地 runtime source；Cocos2d-x 工程/平台 glue 在 C++ 仓库。两者的宿主责任不同。

对应源码详见 [架构对照](../comparisons/cocos2d-x-4-vs-creator-2.4.md)。

## 本地构建可行性检查

2026-10-17 本轮只读检查发现：Xcode 26.6 与 Apple clang 21 可用；未找到 `cmake`；Cocos2d-x `external/` 只有 225 字节的 `config.json`，依赖 payload 未检出；`.gitmodules` 声明的三个 submodule 目录存在但为空；默认模板没有生成好的 Xcode project/workspace。上游 README 也要求运行依赖下载脚本；本轮不下载依赖、不创建构建目录、不改模板。

因此本轮没有运行 Cocos2d-x 样例。后续若要完成对照实测，先恢复与该快照兼容的 CMake 与依赖/submodule，再生成并构建一个 macOS desktop 模板；届时再按 Creator 可用目标选择同平台实验。首帧运行验证仍为待完成。
