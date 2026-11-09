# 第 28 课：对象池 clear 的销毁时机

**目标：** 观察池清空时引用释放和对象析构的先后关系。

## 本课增量

本代 Cocos2d-x 没有内置 `NodePool`。示例的应用层 `clear()` 释放池持有的引用；`ClearProbe` 已脱离场景且只剩池引用，因此引用归零，对象会在 `clear()` 返回前析构。输出中析构日志位于“before clear”和“clear returned”之间。

代码入口：[main.cpp](src/main.cpp)、[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。

## 源码位置

- [NodePool.cpp:23](src/game/NodePool.cpp#L23)：应用层 `clear()` 逐个释放池内节点。
- [cocos2dx/cocoa/CCObject.cpp](../../engine/cocos2d-x-2/cocos2dx/cocoa/CCObject.cpp#L79)：引用计数归零时删除对象。节点释放路径见 [CCNode.cpp](../../engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp#L106)。

## 简化与运行

使用最小节点类与引用计数实现；未实现引擎内置对象池、自动释放池和场景调度。

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/game/NodePool.cpp src/cocos2dx/cocoa/CCObject.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/cocos2d-x-2x-s28
/tmp/cocos2d-x-2x-s28
~~~

观察 `~ClearProbe` 在 `clear()` 返回前输出。
