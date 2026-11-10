# 第 26 课：对象池中的节点运行状态

**目标：** 观察节点入池离场后调度暂停，以及 `cleanup` 对动作和监听的影响。

## 本课内容

重点看节点离场/重新进入与调度恢复。

代码入口：[main.cpp](src/main.cpp)、[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。

## 源码位置

- 本课应用层实现：[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。
- 引擎节点与引用实现：[CCNode.cpp](../../engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp)；[引用计数源码](../../engine/cocos2d-x-2/cocos2dx/cocoa/CCObject.cpp)。
- Cocos2d-x 没有内置通用 `NodePool`；课程池和容量、归属、关闭策略都属于应用层代码。

## 简化与运行

每个目录包含独立源码和版本对应的最小引擎实现。

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/game/NodePool.cpp src/cocos2dx/cocoa/CCObject.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/cocos2d-x-2x-s31
/tmp/cocos2d-x-2x-s31
~~~

池化节点重新挂载后更新计数继续增加；`cleanup=true` 的节点重新挂载后计数不变。
