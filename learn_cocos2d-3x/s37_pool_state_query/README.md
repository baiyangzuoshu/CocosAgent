# 第 37 课：区分空池与已关闭池

**目标：** 看懂 `get()` 都返回空指针时，如何判断对象池是否已经进入终态。

## 本课增量

空池和已关闭池的 `get()` 都返回 `nullptr`。本课在应用层 `NodePool` 增加只读方法 `isDisposed()`，并用独立示例对比两种状态。

代码入口：[main.cpp](src/main.cpp)、[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。

## 源码位置

- 本课状态查询：[NodePool.h](src/game/NodePool.h) 的 `isDisposed()`；[NodePool.cpp](src/game/NodePool.cpp) 的 `get()` 与 `dispose()`。
- Cocos2d-x 没有内置通用 `NodePool`；终态标志和查询方法都是课程新增的应用层逻辑。
- 引擎节点与引用接口：[CCNode.cpp](../../engine/cocos2d-x-3/cocos/2d/CCNode.cpp#L1044)；引用接口：[CCRef.cpp](../../engine/cocos2d-x-3/cocos/base/CCRef.cpp)。终态标志是课程新增的应用层状态。

## 简化与运行

`isDisposed()` 只查询状态；`dispose()` 在第 36 课中设置终态。

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/game/NodePool.cpp src/cocos/base/CCRef.cpp src/cocos/2d/CCNode.cpp -o /tmp/learn_cocos2d-3x-s37
/tmp/learn_cocos2d-3x-s37
~~~
