# 第 29 课：外部引用与对象池清理

**目标：** 分清对象池持有的引用和调用方自己的引用。

## 本课增量

本代 Cocos2d-x 没有内置 `NodePool`。示例中场景移除后，池和调用方各持有一份引用。`clear()` 释放池持有的引用，`ExternalProbe` 的引用计数从 2 降到 1，因此仍存活并可重新挂回场景；最后调用方 `release()` 后才析构。

代码入口：[main.cpp](src/main.cpp)、[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。

## 源码位置

- [NodePool.cpp:8](src/game/NodePool.cpp#L8)：应用层池为节点 `retain()`；[NodePool.cpp:23](src/game/NodePool.cpp#L23)：`clear()` 释放池自己的引用。
- [retain: 91](../../engine/cocos2d-x-4/cocos/base/CCRef.cpp#L91) 与 [release: 97](../../engine/cocos2d-x-4/cocos/base/CCRef.cpp#L97)：引用计数独立维护；只有计数归零才析构。

Creator 对比见 [2.4](../../learn_2.4cocoscreator/s29_pool_external_owner/README.md) 与 [3.8](../../learn_3.8cocoscreator/s29_pool_external_owner/README.md)：其 `NodePool.clear()` 直接请求销毁，不保留池外脚本引用。

## 简化与运行

保留父节点、池、调用方三方引用关系；省略自动释放池、动作系统和引擎场景调度。

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/game/NodePool.cpp src/cocos/base/CCRef.cpp src/cocos/2d/CCNode.cpp -o /tmp/cocos2d-x-4x-s29
/tmp/cocos2d-x-4x-s29
~~~

输出先显示 `refs=2`，清池后为 `refs=1` 且节点仍可重新挂载；最后一次 `release()` 后才看到析构。
