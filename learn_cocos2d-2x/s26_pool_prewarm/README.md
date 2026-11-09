# 第 26 课：对象池预热与首次复用

**目标：** 在首次取用前预先创建两个 CCNode，之后从池中取回已有对象。

## 本课增量

示例启动时构造两个 EnemyNode 并放入应用层节点池，再进行第一次 get。取出的节点与预热时创建的对象是同一实例，复用处理器将 HP 重置为 45。

Cocos2d-x 2.x 没有内置 NodePool；预热数量、构造节点和放入池都由应用层负责。

代码入口：[main.cpp](src/main.cpp)、[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。

## 源码位置

- [CCNode.cpp:532](../../engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp#L532)：CCNode 工厂入口；示例构造其子类作为预热对象。
- [CCObject.cpp:79](../../engine/cocos2d-x-2/cocos2dx/cocoa/CCObject.cpp#L79)：release 引用计数归零后删除对象。预热池的 put/get 位于本课应用层 [NodePool.cpp](src/game/NodePool.cpp)。

## 简化与运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/game/NodePool.cpp src/cocos2dx/cocoa/CCObject.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/cocos2d-x-2x-s26
/tmp/cocos2d-x-2x-s26
~~~

输出先显示预热池有两个节点，再显示第一次 get 取回其中一个原实例。
