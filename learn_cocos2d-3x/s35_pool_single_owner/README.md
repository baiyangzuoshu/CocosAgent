# 第 35 课：限制节点同时归属多个池

**目标：** 应用层保证一个节点同一时刻只由一个对象池持有。

## 本课增量

第34课的池只在自己的 `vector` 中查重。本课增加模块级 `std::unordered_map<Node*, NodePool*>` 归属表：A 池存入节点后，B 池的 `put()` 被拒绝；A 池 `get()` 后删除归属记录，节点可转交给 B 池。取出和清池都会释放登记；引用计数仍由每个池的 `retain/release` 配对管理。

Cocos2d-x 没有内置通用 `NodePool`，本课的归属表属于应用层策略。

代码入口：[main.cpp](src/main.cpp)、[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。

## 源码位置

- 本课归属检查与登记：[NodePool.cpp:20](src/game/NodePool.cpp#L20)；`get()` 移交与 `clear()` 清除登记也在此文件。
- 引擎节点移出层级：[CCNode.cpp](../../engine/cocos2d-x-3/cocos/2d/CCNode.cpp#L1044)；引用接口：[CCRef.cpp](../../engine/cocos2d-x-3/cocos/base/CCRef.cpp)。引擎不维护跨应用层池的归属表。

## 简化与运行

保留归属登记、引用计数和节点移出层级；省略完整调度器、动作系统与场景运行时。

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/game/NodePool.cpp src/cocos/base/CCRef.cpp src/cocos/2d/CCNode.cpp -o /tmp/learn_cocos2d-3x-s35
/tmp/learn_cocos2d-3x-s35
~~~
