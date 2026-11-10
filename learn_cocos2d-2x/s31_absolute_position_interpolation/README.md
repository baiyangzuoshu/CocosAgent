# 第 31 课：时间进度与绝对目标插值

**目标：** 看清 CCMoveTo 如何在动作启动时计算目标差值，再复用 MoveBy 的时间插值。

## 本课递进

两个 CCNode 从 x=2 和 x=-4 出发，各运行 2 秒的 CCMoveTo(10)。动作开始时将绝对终点换算成各自的相对位移，所以最后都到达 x=10。

## 源码位置

- 引擎 [CCMoveTo::startWithTarget](<../../engine/cocos2d-x-2/cocos2dx/actions/CCActionInterval.cpp#L1127>) 根据目标节点当前位置设置位移差。
- 引擎 [CCMoveBy::update](<../../engine/cocos2d-x-2/cocos2dx/actions/CCActionInterval.cpp#L1063>) 用 MoveBy 已有的进度插值更新位置。
- 本课代码入口：[main.cpp](src/main.cpp)、[CCActionInterval.cpp](src/cocos2dx/actions/CCActionInterval.cpp)。

本课只实现水平位置，省略引擎引用计数、二维向量、缓动和动作组合。

## 运行

~~~
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/actions/CCAction.cpp src/cocos2dx/actions/CCActionInterval.cpp src/cocos2dx/actions/CCActionManager.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/cocos2d-2x-s31
/tmp/cocos2d-2x-s31
~~~

输出：frame 1 为 left=4、right=-0.5；frame 4 两者都为 10。
