# 第 25 课：对象池容量上限与超额节点释放

**目标：** 把应用层节点池限制为 1；池满时移除并释放多余节点。

## 本课增量

示例先把 CapacitySeed 放入池，再尝试回收 OverflowCandidate。调用方先检查 size；池满时不调用 put，而是从场景移除节点并释放创建者持有的引用。Cocos2d-x 2.x 没有内置 NodePool，本课的容量判断和节点池都属于课程应用层代码。

代码入口：[main.cpp](src/main.cpp)、[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。

## 源码位置

- [CCNode.cpp:653](../../engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp#L653)：removeChild 将节点从父节点移除。
- [CCObject.cpp:79](../../engine/cocos2d-x-2/cocos2dx/cocoa/CCObject.cpp#L79)：release 减少引用计数，归零后删除对象。示例还提供本课应用层的 [NodePool.cpp](src/game/NodePool.cpp)。

## 简化与运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/game/NodePool.cpp src/cocos2dx/cocoa/CCObject.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/cocos2d-x-2x-s25
/tmp/cocos2d-x-2x-s25
~~~

输出显示池容量为 1，超额节点被移除并释放。
