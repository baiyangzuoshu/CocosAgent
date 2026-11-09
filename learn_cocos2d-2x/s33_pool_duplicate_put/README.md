# 第 33 课：防止节点重复入池

**目标：** 让一个节点在同一个应用层池中只占一个位置。

## 本课增量

示例对同一个节点连续调用两次 `put()`。池的 `std::find` 身份检查拒绝第二次插入，因此池大小为 1、引用只由池额外保留一次；取出一次后，第二次 `get()` 返回空指针。

Cocos2d-x 本身没有通用 `NodePool`。重复检查是应用层池的责任；引擎提供节点层级与引用计数接口。

代码入口：[main.cpp](src/main.cpp)、[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。

## 源码位置

- 本课池实现：[NodePool.cpp:7](src/game/NodePool.cpp#L7)：`put()` 用 `std::find` 检查相同节点指针。
- 引擎节点移出层级：[CCNode.cpp:740](../../engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp#L740)；引用接口：[$CCObject.cpp](../../engine/cocos2d-x-2/cocos2dx/cocoa/CCObject.cpp)。引擎不维护通用池数组，重复插入保护在应用层。

## 简化与运行

保留池数组、指针身份检查、引用计数和空池返回；省略真实调度器、动作系统与完整场景运行时。

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/game/NodePool.cpp src/cocos2dx/cocoa/CCObject.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/learn_cocos2d-2x-s33
/tmp/learn_cocos2d-2x-s33
~~~
