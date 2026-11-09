# 第 34 课：同一节点跨池共享的风险

**目标：** 看清每个应用层池只检查自己的容器，不会登记全局节点所有权。

## 本课增量

示例把同一个节点分别放入池 A 和池 B。两个池的大小都为 1；分别取出后，得到的仍是同一个指针。每次 `put()` 都调用池回调并增加池持有的引用，因此跨池共享会产生多个逻辑所有者。

Cocos2d-x 没有内置通用 `NodePool`。本课中的两个池由应用层实现，去重只搜索各自的 `std::vector`。

代码入口：[main.cpp](src/main.cpp)、[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。

## 源码位置

- 本课池实现：[NodePool.cpp:7](src/game/NodePool.cpp#L7)：`put()` 的 `std::find` 仅检查当前池的 `_nodes`。
- 引擎节点与引用接口：[CCNode.cpp:1044](../../engine/cocos2d-x-3/cocos/2d/CCNode.cpp#L1044)；[CCRef.cpp](../../engine/cocos2d-x-3/cocos/base/CCRef.cpp)。引擎不提供跨 NodePool 的身份登记。

## 简化与运行

保留两个池、共享节点、引用计数和 `get()` 返回身份；省略完整调度器、动作系统与场景运行时。应用层应让一个节点同一时刻只归一个池管理。

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/game/NodePool.cpp src/cocos/base/CCRef.cpp src/cocos/2d/CCNode.cpp -o /tmp/learn_cocos2d-3x-s34
/tmp/learn_cocos2d-3x-s34
~~~
