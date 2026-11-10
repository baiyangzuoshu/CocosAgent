# 第 25 课：清池与节点存活

**目标：** 观察 `clear()` 释放池引用；调用方是否仍持有引用决定节点是否析构。

## 本课内容

本代引擎使用引用计数，引用归零时同步析构。

代码入口：[main.cpp](src/main.cpp)、[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。

## 源码位置

- 本课应用层实现：[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。
- 引擎节点与引用实现：[CCNode.cpp](../../engine/cocos2d-x-4/cocos/2d/CCNode.cpp)；[引用计数源码](../../engine/cocos2d-x-4/cocos/base/CCRef.cpp)。
- Cocos2d-x 没有内置通用 `NodePool`；课程池和容量、归属、关闭策略都属于应用层代码。

## 简化与运行

每个目录包含独立源码和版本对应的最小引擎实现。

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/game/NodePool.cpp src/cocos/base/CCRef.cpp src/cocos/2d/CCNode.cpp -o /tmp/cocos2d-x-4x-s29
/tmp/cocos2d-x-4x-s29
~~~

输出先显示 `refs=2`，清池后为 `refs=1` 且节点仍可重新挂载；最后一次 `release()` 后才看到析构。
