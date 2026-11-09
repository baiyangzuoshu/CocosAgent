# 第 32 课：节点池的后进先出顺序

**目标：** 观察节点池如何决定先返回哪个节点。

## 本课增量

示例按 A、B 的顺序调用 `put()`，然后连续调用两次 `get()`；先取出 B，再取出 A。课程应用层池用 `std::vector` 保存节点，`back()` 配合 `pop_back()` 实现后进先出（LIFO）。

Cocos2d-x 本身没有通用 `NodePool`。这里的 LIFO 策略属于课程中的应用层池；引擎负责节点父子关系和引用计数。

代码入口：[main.cpp](src/main.cpp)、[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。

## 源码位置

- 本课池实现：[NodePool.cpp:15](src/game/NodePool.cpp#L15)：`get()` 使用 `back()` 读取末项，再用 `pop_back()` 移出。
- 引擎节点脱离父节点：[CCNode.cpp:740](../../engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp#L740)；引用计数：[CCObject.cpp](../../engine/cocos2d-x-2/cocos2dx/cocoa/CCObject.cpp)。引擎没有通用池类，取出顺序由应用层容器决定。

## 简化与运行

示例保留最小池、引用转移和 `get()` 顺序；省略真实调度器、动作系统与引擎自带场景运行时。当前实现的 LIFO 来自 `vector` 的尾部操作；若需要 FIFO，应在应用层改用队列。

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/game/NodePool.cpp src/cocos2dx/cocoa/CCObject.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/learn_cocos2d-2x-s32
/tmp/learn_cocos2d-2x-s32
~~~
