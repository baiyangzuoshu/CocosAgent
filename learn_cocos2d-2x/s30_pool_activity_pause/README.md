# 第 30 课：池中节点暂停调度

**目标：** 看清从场景移出的节点是否继续执行调度回调。

## 本课增量

本代 Cocos2d-x 没有内置 `NodePool`，示例用应用层池暂存节点。节点入池时从正在运行的场景移除，触发 `onExit()` 并暂停调度；池内手动推进三次回调，计数不变。`get()` 取出后重新挂入场景，触发 `onEnter()` 恢复调度，计数继续增加。

代码入口：[main.cpp](src/main.cpp)、[NodePool.cpp](src/game/NodePool.cpp)、[CCNode.cpp](src/cocos2dx/base_nodes/CCNode.cpp)。

## 源码位置

- [CCNode.cpp:911](../../engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp#L911)：`onEnter()` 恢复节点的调度目标。
- [CCNode.cpp:959](../../engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp#L959)：`onExit()` 暂停节点的调度目标。
- [CCNode.cpp:1120](../../engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp#L1120) 与 [CCNode.cpp:1126](../../engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp#L1126)：具体调用 Scheduler 与 ActionManager 的恢复/暂停接口。

## 简化与运行

示例保留节点运行状态和暂停/恢复的调用点，用一个手动推进的回调模拟 Scheduler；省略真实的调度队列、动作系统和场景切换。

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/game/NodePool.cpp src/cocos2dx/cocoa/CCObject.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/cocos2d-x-2x-s30
/tmp/cocos2d-x-2x-s30
~~~

输出中池内节点仍有 `refs=2`，但 `updates` 保持不变且 `scheduler paused=true`；重新挂载后 `updates` 增加。
