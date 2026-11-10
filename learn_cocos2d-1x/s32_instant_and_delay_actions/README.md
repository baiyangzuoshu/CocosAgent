# 第 32 课：即时回调与延迟动作

**目标：** 观察 CallFunc 的执行时机，以及 DelayTime 如何只消耗时间。

## 本课递进

节点分别运行 CallFunc 和 1 秒 CCDelayTime。输出会显示 `runAction` 前后回调状态，再逐帧显示延迟进度与活动动作数。Cocos2d-x 1.x 在 `CCCallFunc::startWithTarget` 中同步调用回调，所以回调发生在 `runAction` 返回之前。

## 源码位置

- 引擎 `engine/cocos2d-x-1/cocos2dx/actions/CCActionInstant.cpp`：`CCCallFunc::startWithTarget` 调用 `execute`；`CCActionInstant::step/update/isDone` 定义即时动作行为。
- 引擎 `engine/cocos2d-x-1/cocos2dx/actions/CCActionInterval.cpp`：`CCDelayTime::update` 不修改目标，只由父类累计时间。
- 引擎 `engine/cocos2d-x-1/cocos2dx/actions/CCActionManager.cpp` 和 `CCScheduler.cpp`：动作启动、管理与帧更新。

代码入口：[main.cpp](src/main.cpp)、[CCActionInstant.cpp](src/cocos2dx/actions/CCActionInstant.cpp)、[CCActionInterval.cpp](src/cocos2dx/actions/CCActionInterval.cpp)、[CCActionManager.cpp](src/cocos2dx/actions/CCActionManager.cpp)。

本课用 `std::function` 代替引擎的 Objective-C 风格 selector，保留同步回调时机；省略引用计数、动作复制与完整目标选择器参数。

## 运行

~~~
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/actions/CCAction.cpp src/cocos2dx/actions/CCActionInstant.cpp src/cocos2dx/actions/CCActionInterval.cpp src/cocos2dx/actions/CCActionManager.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/cocos2d-1x-s32
/tmp/cocos2d-1x-s32
~~~

输出中，`CallFunc callback` 位于 `after runAction` 之前；第 4 帧延迟完成，活动动作数归零。
