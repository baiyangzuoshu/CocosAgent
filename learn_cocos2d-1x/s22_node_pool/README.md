# 第 22 课：节点池复用

**目标：** 暂存一个脱离场景的节点，再把同一对象挂回场景。

## 本课增量

`NodePool::put()` 先为池保留一份引用，再以 `cleanup=false` 移除父节点持有；`get()` 把池的引用交还给调用者。示例打印池大小、父节点状态和对象地址是否相同。`clear()` 释放池持有的最后一份引用，节点随之析构。

代码入口：[main.cpp](src/main.cpp)、[NodePool.h](src/game/NodePool.h)、[NodePool.cpp](src/game/NodePool.cpp)、[CCNode.h](src/cocos2dx/include/CCNode.h)、[CCObject.h](src/cocos2dx/include/CCObject.h).

## 源码位置

- [CCNode.cpp:644](../../engine/cocos2d-x-1/cocos2dx/base_nodes/CCNode.cpp#L644) 与 [CCNode.cpp:707](../../engine/cocos2d-x-1/cocos2dx/base_nodes/CCNode.cpp#L707)：移除节点时传递 cleanup 参数，并从父节点脱离。
- [CCObject.cpp:74](../../engine/cocos2d-x-1/cocos2dx/cocoa/CCObject.cpp#L74) 与 [CCObject.cpp:85](../../engine/cocos2d-x-1/cocos2dx/cocoa/CCObject.cpp#L85)：池保留和释放节点引用。

## 简化与运行

本代引擎没有内置 `NodePool`；示例在 `game/` 中实现最小应用层对象池，使用本代 `CCNode` / `Node` 与 `CCObject` / `Ref` 接口。省略动作重置和自动释放池。

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/game/NodePool.cpp src/cocos2dx/cocoa/CCObject.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/cocos2d-x-1-s22
/tmp/cocos2d-x-1-s22
~~~

输出中 EnemyA 进入池后仍有效；取回时地址相同；清空池后才看到析构。
