# 第 33 课：串行与并行动作

**目标：** 看懂 `Sequence` 如何切分时间进度，以及 `Spawn` 如何并行运行并等待较长分支结束。

## 本课内容

`Spawn` 同时运行两条分支：短分支等待 0.25 秒，长分支等待 0.50 秒。短分支回调先执行；并行组结束后，外层 `Sequence` 才执行最后的回调。

较短分支会用 `Sequence(action, DelayTime)` 补齐到最长分支的时长。4.x 的 `CallFunc::update` 在动作更新时执行回调。

## 源码位置

- 引擎 `engine/cocos2d-x-4/cocos/2d/CCActionInterval.cpp`：[Sequence 更新](../../engine/cocos2d-x-4/cocos/2d/CCActionInterval.cpp#L339)、[Spawn 补时](../../engine/cocos2d-x-4/cocos/2d/CCActionInterval.cpp#L707)。
- 引擎 `engine/cocos2d-x-4/cocos/2d/CCActionInstant.cpp`：[即时动作更新](../../engine/cocos2d-x-4/cocos/2d/CCActionInstant.cpp#L48)、[CallFunc 回调](../../engine/cocos2d-x-4/cocos/2d/CCActionInstant.cpp#L365)。
- 本课实现：[动作基类](src/cocos/2d/CCAction.h)、[间隔与组合动作](src/cocos/2d/CCActionInterval.cpp)、[回调动作](src/cocos/2d/CCActionInstant.cpp)、[演示入口](src/main.cpp)。

## 编译与运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCAction.cpp src/cocos/2d/CCActionInstant.cpp src/cocos/2d/CCActionInterval.cpp src/cocos/2d/CCActionManager.cpp src/cocos/base/CCScheduler.cpp src/cocos/2d/CCNode.cpp -o /tmp/cocos2d-4x-s33
/tmp/cocos2d-4x-s33
~~~

输出会显示短分支在 0.25 秒完成，长分支与外层回调在 0.50 秒完成。示例省略引擎的引用计数和复制机制，用 `std::function` 表示回调。
