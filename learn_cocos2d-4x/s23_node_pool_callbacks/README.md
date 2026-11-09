# 第 23 课：节点池回收与复用回调

**目标：** 回收节点时重置临时状态，取回时恢复可复用状态。

## 本课增量

本代引擎没有内置节点池回调。示例在应用层 `PoolHandler` 中定义 `unuse/reuse`：节点以 `cleanup=false` 移出父节点后调用 `unuse()`；`get(45)` 在节点重新挂入场景前调用 `reuse()`，恢复 HP 与临时效果。

代码入口：[main.cpp](src/main.cpp)、[NodePool.h](src/game/NodePool.h)、[NodePool.cpp](src/game/NodePool.cpp)。这里的 `PoolHandler` 是课程应用层接口，不是引擎 API。

## 源码位置

- [CCNode.cpp:1003](../../engine/cocos2d-x-4/cocos/2d/CCNode.cpp#L1003)：移除子节点并传入 `cleanup`；[CCNode.cpp:1085](../../engine/cocos2d-x-4/cocos/2d/CCNode.cpp#L1085)：父节点脱离逻辑。
- [CCRef.cpp:91](../../engine/cocos2d-x-4/cocos/base/CCRef.cpp#L91) 与 [CCRef.cpp:97](../../engine/cocos2d-x-4/cocos/base/CCRef.cpp#L97)：池保留节点、取回后移交引用所依赖的引用计数接口。

## 简化与运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/game/NodePool.cpp src/cocos/base/CCRef.cpp src/cocos/2d/CCNode.cpp -o /tmp/cocos2d-x-4x-s23
/tmp/cocos2d-x-4x-s23
~~~

输出显示 `unuse` 在离开父节点后运行，`reuse(45)` 在重新挂载前运行；HP 和临时效果随之重置。
