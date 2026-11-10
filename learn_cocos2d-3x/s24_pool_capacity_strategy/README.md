# 第 24 课：对象池容量与预热补充

**目标：** 把容量上限、启动预热和低水位补充组合为应用层策略。

## 本课内容

容量与补货由调用方控制，NodePool 只管理已接收的节点。

代码入口：[main.cpp](src/main.cpp)、[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。

## 源码位置

- 本课应用层实现：[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。
- 引擎节点与引用实现：[CCNode.cpp](../../engine/cocos2d-x-3/cocos/2d/CCNode.cpp)；[引用计数源码](../../engine/cocos2d-x-3/cocos/base/CCRef.cpp)。
- Cocos2d-x 没有内置通用 `NodePool`；课程池和容量、归属、关闭策略都属于应用层代码。

## 简化与运行

每个目录包含独立源码和版本对应的最小引擎实现。

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/game/NodePool.cpp src/cocos/base/CCRef.cpp src/cocos/2d/CCNode.cpp -o /tmp/cocos2d-x-3x-s27
/tmp/cocos2d-x-3x-s27
~~~

输出显示首次 get 复用预热对象，低水位触发补货，池大小到达 4。
