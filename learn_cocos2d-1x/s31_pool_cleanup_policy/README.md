# 第 31 课：回收与清理的区别

**目标：** 分清节点离场时的临时暂停与显式清理。

## 本课增量

Cocos2d-x 没有内置 `NodePool`。应用层池用 `removeChild(node, false)` 暂存节点；它的调度目标暂停，取回并重新挂载后可以恢复。示例再用 `removeChild(node, true)` 清理另一个节点：`cleanup()` 移除已登记的调度回调，之后重新挂载也不会恢复该回调。

代码入口：[main.cpp](src/main.cpp)、[NodePool.cpp](src/game/NodePool.cpp)、[CCNode.cpp](src/cocos2dx/base_nodes/CCNode.cpp)。

## 源码位置

- [CCNode.cpp:719](../../engine/cocos2d-x-1/cocos2dx/base_nodes/CCNode.cpp#L719)：先触发 `onExit()`，再按 `cleanup` 参数决定是否清理。
- [CCNode.cpp:554](../../engine/cocos2d-x-1/cocos2dx/base_nodes/CCNode.cpp#L554)：停止动作并取消定时回调。
- 示例池使用 `removeChild(node, false)`；源码中 Cocos2d-x 没有内置 `NodePool`。

## 简化与运行

用一个手动推进的回调模拟 Scheduler；省略真实调度队列与 ActionManager。

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/game/NodePool.cpp src/cocos2dx/cocoa/CCObject.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/cocos2d-x-1x-s31
/tmp/cocos2d-x-1x-s31
~~~

池化节点重新挂载后更新计数继续增加；`cleanup=true` 的节点重新挂载后计数不变。
