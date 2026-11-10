# 第 32 课：即时回调与延迟动作

**目标：** 观察 CallFunc 在动作更新时执行，以及 DelayTime 如何只消耗时间。

## 本课递进

节点分别运行 CallFunc 和 1 秒 CCDelayTime。输出会显示 `runAction` 前后回调状态，再逐帧显示延迟进度与活动动作数。Cocos2d-x 2.x 在 `CCActionManager` 首次更新时执行 CallFunc。

## 源码位置

- 引擎 `engine/cocos2d-x-2/cocos2dx/actions/CCActionInstant.cpp`：`CCActionInstant::step` 调用 `update(1)`，`CCCallFunc::update` 执行回调。
- 引擎 `engine/cocos2d-x-2/cocos2dx/actions/CCActionInterval.cpp`：`CCDelayTime::update` 不修改目标，只由父类累计时间。
- 引擎 `engine/cocos2d-x-2/cocos2dx/actions/CCActionManager.cpp` 与 `CCScheduler.cpp`：动作管理和帧更新。

代码入口：[main.cpp](src/main.cpp)、[CCActionInstant.cpp](src/cocos2dx/actions/CCActionInstant.cpp)、[CCActionInterval.cpp](src/cocos2dx/actions/CCActionInterval.cpp)、[CCActionManager.cpp](src/cocos2dx/actions/CCActionManager.cpp)。省略动作复制、引用计数与链式组合。

## 运行

~~~
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/actions/CCAction.cpp src/cocos2dx/actions/CCActionInstant.cpp src/cocos2dx/actions/CCActionInterval.cpp src/cocos2dx/actions/CCActionManager.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/cocos2d-2x-s32
/tmp/cocos2d-2x-s32
~~~

输出中，回调在 `after runAction` 之后、`after first update` 之前触发；第 4 帧延迟完成，活动动作数归零。
