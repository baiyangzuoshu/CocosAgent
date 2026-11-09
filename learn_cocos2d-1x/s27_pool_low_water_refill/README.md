# 第 27 课：对象池低水位补充

**目标：** 池内节点降到 1 个时按批补充，池大小不超过 4。

## 本课增量

示例先预热 2 个节点。第一次 get 后，调用方检查池大小；到低水位 1 时创建并入池最多 3 个节点，直到达到容量上限 4。Cocos2d-x 1.x 没有内置 NodePool，阈值、批量创建和容量限制均由应用层实现。

代码入口：[main.cpp](src/main.cpp)、[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。

## 源码位置

- [CCNode.cpp:47](../../engine/cocos2d-x-1/cocos2dx/base_nodes/CCNode.cpp#L47)：CCNode 构造入口；示例用其子类创建补货节点。
- [CCObject.cpp:74](../../engine/cocos2d-x-1/cocos2dx/cocoa/CCObject.cpp#L74)：release 引用计数归零后删除对象。池的 put/get 位于本课应用层 [NodePool.cpp](src/game/NodePool.cpp)。

## 简化与运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/game/NodePool.cpp src/cocos2dx/cocoa/CCObject.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/cocos2d-x-1x-s27
/tmp/cocos2d-x-1x-s27
~~~

输出显示首次 get 复用预热对象，低水位触发补货，池大小到达 4。
