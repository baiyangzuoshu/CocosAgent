# 第 27 课：取出顺序与重复入池保护

**目标：** 用 vector 尾部实现 LIFO，并通过指针身份防止重复入池。

## 本课内容

重点看应用层 `get()` 的尾部操作和 `put()` 的去重条件。

代码入口：[main.cpp](src/main.cpp)、[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。

## 源码位置

- 本课应用层实现：[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。
- 引擎节点与引用实现：[CCNode.cpp](../../engine/cocos2d-x-4/cocos/2d/CCNode.cpp)；[引用计数源码](../../engine/cocos2d-x-4/cocos/base/CCRef.cpp)。
- Cocos2d-x 没有内置通用 `NodePool`；课程池和容量、归属、关闭策略都属于应用层代码。

## 简化与运行

每个目录包含独立源码和版本对应的最小引擎实现。

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/game/NodePool.cpp src/cocos/base/CCRef.cpp src/cocos/2d/CCNode.cpp -o /tmp/learn_cocos2d-4x-s27
/tmp/learn_cocos2d-4x-s27
~~~
