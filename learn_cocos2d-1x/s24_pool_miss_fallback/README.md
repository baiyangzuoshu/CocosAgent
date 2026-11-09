# 第 24 课：对象池未命中与节点工厂兜底

**目标：** 池中没有可用节点时，创建新节点继续运行。

## 本课增量

本代引擎没有内置 NodePool。示例清空应用层对象池后再次调用 `get()`，读到空结果后由调用方创建 `EnemyFallback` 并挂入场景。新节点保持构造时的初始状态，因此没有调用池处理器的 `reuse()`。

代码入口：[main.cpp](src/main.cpp)、[NodePool.cpp](src/game/NodePool.cpp)、[NodePool.h](src/game/NodePool.h)。池为空返回空指针和 `new EnemyNode` 兜底都是课程应用层逻辑。

## 源码位置

- [CCNode.cpp:47](../../engine/cocos2d-x-1/cocos2dx/base_nodes/CCNode.cpp#L47)：本代引擎节点构造/工厂入口；本例用子类构造新 Enemy。
- [CCObject.cpp:85](../../engine/cocos2d-x-1/cocos2dx/cocoa/CCObject.cpp#L85)、[CCObject.cpp:74](../../engine/cocos2d-x-1/cocos2dx/cocoa/CCObject.cpp#L74)：新节点挂入父节点后由场景树持有引用，移除后释放引用。

## 简化与运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/game/NodePool.cpp src/cocos2dx/cocoa/CCObject.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/cocos2d-x-1x-s24
/tmp/cocos2d-x-1x-s24
~~~

输出先显示空池，再显示新节点的初始 HP 和临时效果；该新节点没有经过 `reuse()`。
