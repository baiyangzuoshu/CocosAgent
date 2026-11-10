# 第 33 课：串行与并行动作

**目标：** 看懂 `CCSequence` 如何切分时间进度，以及 `CCSpawn` 如何并行运行并等待较长分支结束。

## 本课内容

`CCSpawn` 同时运行两条分支：短分支等待 0.25 秒，长分支等待 0.50 秒。短分支回调先执行；并行组结束后，外层 `CCSequence` 才执行最后的回调。

较短分支会用 `CCSequence(action, CCDelayTime)` 补齐到最长分支的时长。1.x 的 `CCCallFunc::startWithTarget` 同步执行回调；组合动作在进入对应分支时才启动子动作，因此回调仍按时间线触发。

## 源码位置

- 引擎 `engine/cocos2d-x-1/cocos2dx/actions/CCActionInterval.cpp`：[CCSequence 进度切分](../../engine/cocos2d-x-1/cocos2dx/actions/CCActionInterval.cpp#L260)、[CCSequence 更新](../../engine/cocos2d-x-1/cocos2dx/actions/CCActionInterval.cpp#L274)、[CCSpawn 补时](../../engine/cocos2d-x-1/cocos2dx/actions/CCActionInterval.cpp#L595)。
- 引擎 `engine/cocos2d-x-1/cocos2dx/actions/CCActionInstant.cpp`：[CallFunc 在 startWithTarget 中执行](../../engine/cocos2d-x-1/cocos2dx/actions/CCActionInstant.cpp#L352)。
- 本课实现：[动作基类](src/cocos2dx/actions/CCAction.h)、[间隔与组合动作](src/cocos2dx/actions/CCActionInterval.cpp)、[回调动作](src/cocos2dx/actions/CCActionInstant.cpp)、[演示入口](src/main.cpp)。

## 编译与运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/actions/CCAction.cpp src/cocos2dx/actions/CCActionInstant.cpp src/cocos2dx/actions/CCActionInterval.cpp src/cocos2dx/actions/CCActionManager.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/cocos2d-1x-s33
/tmp/cocos2d-1x-s33
~~~

输出会显示短分支在 0.25 秒完成，长分支与外层回调在 0.50 秒完成。示例省略引擎的引用计数和复制机制，用 `std::function` 表示回调。
