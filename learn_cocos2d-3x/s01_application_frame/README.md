# 第 1 课：应用入口与帧循环

**目标：** 平台循环触发 Director；Director 更新时间并绘制当前场景。

## 源码位置

- `engine/cocos2d-x-3/cocos/base/CCDirector.cpp:252`：Director::drawScene()：驱动每帧更新与场景访问。
- `engine/cocos2d-x-3/cocos/base/CCDirector.cpp:850`：Director::runWithScene()：设置首个场景。
- `engine/cocos2d-x-3/cocos/base/CCDirector.cpp:1464`：Director::mainLoop()：一帧的统一入口。
- `engine/cocos2d-x-3/cocos/base/CCDirector.cpp:1485`：Director::mainLoop(dt)：接收平台传入的时间步长。
- `engine/cocos2d-x-3/cocos/base/CCScheduler.cpp:823`：Scheduler::update(dt)：推进调度任务。
- `engine/cocos2d-x-3/cocos/platform/mac/CCApplication-mac.mm:97`：Mac 帧循环：调用 mainLoop()。

## 本课代码

代码放在 `src/`，目录按 `engine/cocos2d-x-3/` 镜像。平台帧循环进入 `mainLoop()`，Director 再调用 `drawScene()`。`main.cpp` 用固定三帧模拟平台循环；`Scene` 只保留 `visit()` 以标记场景绘制阶段。

## 观察结果

平台循环打印三帧；每帧先更新 Scheduler，再访问当前 Scene。

## 编译运行

在本课目录执行：

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/base/CCDirector.cpp src/cocos/base/CCScheduler.cpp src/cocos/2d/CCScene.cpp -o /tmp/cocos2d-3x-s01
/tmp/cocos2d-3x-s01
~~~

这是本课自己的精简实现；没有编译或调用完整引擎。
