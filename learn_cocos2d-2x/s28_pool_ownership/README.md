# 第 28 课：节点池所有权与接收结果

**目标：** 共享归属表限制节点同时属于多个池；`put()` 用 `bool` 告诉调用方是否接收。

## 本课内容

只有成功加入池并转移池引用后才返回 `true`。

代码入口：[main.cpp](src/main.cpp)、[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。

## 源码位置

- 本课应用层实现：[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。
- 引擎节点与引用实现：[CCNode.cpp](../../engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp)；[引用计数源码](../../engine/cocos2d-x-2/cocos2dx/cocoa/CCObject.cpp)。
- Cocos2d-x 没有内置通用 `NodePool`；课程池和容量、归属、关闭策略都属于应用层代码。

## 简化与运行

每个目录包含独立源码和版本对应的最小引擎实现。

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/game/NodePool.cpp src/cocos2dx/cocoa/CCObject.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/learn_cocos2d-2x-s28
/tmp/learn_cocos2d-2x-s28
~~~
