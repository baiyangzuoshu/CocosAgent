# 第 23 课：对象池复用与未命中兜底

**目标：** 回收时调用 `unuse()`，取回时调用 `reuse()`；池未命中时由调用方创建节点。

## 本课内容

应用层 `NodePool` 的 `put/get` 与工厂兜底入口。

代码入口：[main.cpp](src/main.cpp)、[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。

## 源码位置

- 本课应用层实现：[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。
- 引擎节点与引用实现：[CCNode.cpp](../../engine/cocos2d-x-3/cocos/2d/CCNode.cpp)；[引用计数源码](../../engine/cocos2d-x-3/cocos/base/CCRef.cpp)。
- Cocos2d-x 没有内置通用 `NodePool`；课程池和容量、归属、关闭策略都属于应用层代码。

## 简化与运行

每个目录包含独立源码和版本对应的最小引擎实现。

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/game/NodePool.cpp src/cocos/base/CCRef.cpp src/cocos/2d/CCNode.cpp -o /tmp/cocos2d-x-3x-s24
/tmp/cocos2d-x-3x-s24
~~~

输出先显示空池，再显示新节点的初始 HP 和临时效果；该新节点没有经过 `reuse()`。
