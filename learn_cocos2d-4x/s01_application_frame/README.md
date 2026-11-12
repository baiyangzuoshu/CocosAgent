# 第 1 课：Application 启动与帧循环

**目标：** 从平台入口追到 AppDelegate，再看 Director 如何逐帧更新并访问当前场景。

## 源码位置

- `engine/cocos2d-x-4/templates/cpp-template-default/proj.ios_mac/mac/main.cpp:31`：macOS 模板创建 `AppDelegate` 并调用 `Application::run()`。
- `engine/cocos2d-x-4/cocos/platform/mac/CCApplication-mac.mm:64`：`Application::run()` 调用启动回调并驱动桌面循环。
- `engine/cocos2d-x-4/templates/cpp-template-default/Classes/AppDelegate.cpp:69`、`:113`：初始化 Director，创建首个场景并调用 `runWithScene()`。
- `engine/cocos2d-x-4/cocos/base/CCDirector.cpp:1378`：`Director::mainLoop()` 进入一帧；`:248`：`drawScene()` 更新 Scheduler 并访问运行场景。
- `engine/cocos2d-x-4/cocos/base/CCScheduler.cpp:823`：`Scheduler::update(dt)` 推进调度任务。
- `engine/cocos2d-x-4/cocos/2d/CCScene.cpp:117`：`Scene::create()` 创建首个场景。
- 详细启动边界见[4.0 应用启动与帧循环源码追踪](../../docs/cocos2d-x/01-startup-and-frame.md)。

## 本课代码

示例对应本地 4.0 C++ macOS 模板路径：`main()` 创建 `AppDelegate`，`Application::run()` 调用 `applicationDidFinishLaunching()`，随后模拟 3 帧；回调通过 `Director::getInstance()` 和 `Scene::create()` 启动场景，Director 的 `mainLoop()` 推进 Scheduler 并访问场景。

## 观察结果

每帧先由平台循环进入 Director，再更新 Scheduler、输出 `drawScene` 并访问当前 Scene。

## 简化

只保留 macOS 桌面模板的调用顺序。省略 GLView 创建、窗口事件轮询、等待帧间隔、渲染后端和平台差异。独立版没有引入 `Ref`/autorelease pool，Director 用 `std::unique_ptr` 持有当前 Scene；完整引擎由 autorelease pool 与场景栈的引用共同管理对象。示例不是完整 Cocos2d-x 工程，也不是运行时验收。

## 运行

在本课目录运行：

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/Classes/AppDelegate.cpp src/cocos/platform/CCApplication.cpp src/cocos/base/CCDirector.cpp src/cocos/base/CCScheduler.cpp src/cocos/2d/CCScene.cpp -o /tmp/cocos2d-x-4-s01
/tmp/cocos2d-x-4-s01
~~~
