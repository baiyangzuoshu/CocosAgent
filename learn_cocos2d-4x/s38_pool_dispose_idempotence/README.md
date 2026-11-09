# 第 38 课：重复 dispose 保持同一终态

**目标：** 验证对象池重复关闭时，状态和引用计数保持稳定。

## 本课增量

第一次 `dispose()` 设置终态并清池；后续调用直接返回，避免重复释放池引用。示例显式调用两次，并比较池大小、终态标志和节点引用计数。

代码入口：[main.cpp](src/main.cpp)、[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。

## 源码位置

- 本课幂等保护：[NodePool.cpp:12](src/game/NodePool.cpp#L12) 的析构调用，以及 [NodePool.cpp:50-54](src/game/NodePool.cpp#L50) 的 `dispose()`。
- Cocos2d-x 没有内置通用 `NodePool`；关闭状态和幂等保护属于课程新增的应用层逻辑。
- 引擎节点与引用接口：[CCNode.cpp](../../engine/cocos2d-x-4/cocos/2d/CCNode.cpp#L1003)；引用接口：[CCRef.cpp](../../engine/cocos2d-x-4/cocos/base/CCRef.cpp)。终态标志是课程新增的应用层状态。

## 简化与运行

重复调用保持同一结果；对象池析构再次调用 `dispose()` 时也能安全返回。

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/game/NodePool.cpp src/cocos/base/CCRef.cpp src/cocos/2d/CCNode.cpp -o /tmp/learn_cocos2d-4x-s38
/tmp/learn_cocos2d-4x-s38
~~~
