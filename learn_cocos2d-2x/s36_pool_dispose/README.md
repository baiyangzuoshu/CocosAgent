# 第 36 课：对象池 dispose 后禁止继续使用

**目标：** 区分可复用的 `clear()` 与终态的 `dispose()`。

## 本课增量

Cocos2d-x 没有内置通用 `NodePool`。本课的应用层池增加 `_disposed` 状态：`dispose()` 先关闭池，再调用 `clear()`；此后 `put()` 不再接收节点，`get()` 返回空指针。示例保留调用方引用，确保清池释放池引用后仍能安全观察这两个结果。

代码入口：[main.cpp](src/main.cpp)、[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。

## 源码位置

- 本课 `dispose()`、`put/get` 和 `clear()`：[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。
- 引擎节点与引用接口：[CCNode.cpp](../../engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp#L653)；引用接口：[CCObject.cpp](../../engine/cocos2d-x-2/cocos2dx/cocoa/CCObject.cpp)。终态标志是课程新增的应用层状态。

## 简化与运行

`clear()` 仍可继续使用；`dispose()` 是幂等的终态操作，析构时也会调用它。

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/game/NodePool.cpp src/cocos2dx/cocoa/CCObject.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/learn_cocos2d-2x-s36
/tmp/learn_cocos2d-2x-s36
~~~
