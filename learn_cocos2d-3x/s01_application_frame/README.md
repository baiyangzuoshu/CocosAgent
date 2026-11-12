# 第 1 课：应用入口与帧循环

**目标：** 平台循环触发 Director；Director 更新时间并绘制当前场景。

## 源码位置

- `engine/cocos2d-x-3/cocos/base/CCDirector.cpp:101`：`Director::getInstance()` 返回 Director 单例。
- `engine/cocos2d-x-3/cocos/2d/CCScene.cpp:132`：`Scene::create()` 初始化并 autorelease 新场景。
- `engine/cocos2d-x-3/cocos/base/CCDirector.cpp:252`：Director::drawScene()：驱动每帧更新与场景访问。
- `engine/cocos2d-x-3/cocos/base/CCDirector.cpp:850`：Director::runWithScene()：设置首个场景。
- `engine/cocos2d-x-3/cocos/base/CCDirector.cpp:1464`：Director::mainLoop()：一帧的统一入口。
- `engine/cocos2d-x-3/cocos/base/CCDirector.cpp:1485`：Director::mainLoop(dt)：接收平台传入的时间步长。
- `engine/cocos2d-x-3/cocos/base/CCScheduler.cpp:823`：Scheduler::update(dt)：推进调度任务。
- `engine/cocos2d-x-3/cocos/platform/mac/CCApplication-mac.mm:97`：Mac 帧循环：调用 mainLoop()。

## 本课代码

代码放在 `src/`，目录按 `engine/cocos2d-x-3/` 镜像。`main.cpp` 通过 `Director::getInstance()` 取得 Director，用 `Scene::create()` 创建首个场景，再调用 `runWithScene()`；平台帧循环通过 `mainLoop()` 推进，固定模拟三帧。本课删去了 `Ref`/autorelease pool，因此精简版 Director 用 `std::unique_ptr` 持有运行中的场景，代替完整引擎里的场景栈对 autorelease 场景的引用持有。`Scene` 只保留 `visit()` 以标记场景绘制阶段。

## 观察结果

平台循环打印三帧；每帧先更新 Scheduler，再访问当前 Scene。

## 编译运行

在本课目录执行：

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/base/CCDirector.cpp src/cocos/base/CCScheduler.cpp src/cocos/2d/CCScene.cpp -o /tmp/cocos2d-3x-s01
/tmp/cocos2d-3x-s01
~~~

这是本课自己的精简实现；没有编译或调用完整引擎。
