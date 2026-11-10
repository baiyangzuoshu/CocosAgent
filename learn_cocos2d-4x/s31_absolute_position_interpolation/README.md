# 第 31 课：时间进度与绝对目标插值

**目标：** 看清 MoveTo 如何在动作启动时计算目标差值，再复用 MoveBy 的时间插值。

## 本课递进

两个 Node 从 x=2 和 x=-4 出发，各运行 2 秒的 MoveTo(10)。动作开始时将绝对终点换算成各自的相对位移，所以最后都到达 x=10。

## 源码位置

- 引擎 [MoveTo::startWithTarget](<../../engine/cocos2d-x-4/cocos/2d/CCActionInterval.cpp#L1265>) 根据目标节点当前位置设置位移差。
- 引擎 [MoveBy::update](<../../engine/cocos2d-x-4/cocos/2d/CCActionInterval.cpp#L1201>) 用 MoveBy 已有的进度插值更新位置。
- 本课代码入口：[main.cpp](src/main.cpp)、[CCActionInterval.cpp](src/cocos/2d/CCActionInterval.cpp)。

本课只实现水平位置，省略引用计数、三维位置、缓动和动作组合。

## 运行

~~~
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCAction.cpp src/cocos/2d/CCActionInterval.cpp src/cocos/2d/CCActionManager.cpp src/cocos/base/CCScheduler.cpp src/cocos/2d/CCNode.cpp -o /tmp/cocos2d-4x-s31
/tmp/cocos2d-4x-s31
~~~

输出：frame 1 为 left=4、right=-0.5；frame 4 两者都为 10。
