# 第 21 课：cleanup 与引用释放

**目标：** 分清节点清理和对象析构。

## 本课增量

`removeChild(child, true)` 先退出活动场景，再递归 `cleanup()`，最后释放父节点对子节点的引用。EnemyA 只剩父节点持有时会立即析构；EnemyB 还有创建者持有的引用，移除后仍存活，最后一次 `release()` 才析构。

代码入口：[main.cpp](src/main.cpp)、[CCNode.h](src/cocos2dx/base_nodes/CCNode.h)、[CCNode.cpp](src/cocos2dx/base_nodes/CCNode.cpp)、[CCObject.h](src/cocos2dx/cocoa/CCObject.h)、[CCObject.cpp](src/cocos2dx/cocoa/CCObject.cpp)。

## 源码位置

- [CCNode.cpp:546](../../engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp#L546)：`cleanup()` 清理节点运行内容并递归处理子节点。
- [CCNode.cpp:653](../../engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp#L653) 与 [CCNode.cpp:727](../../engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp#L727)：移除子节点、执行 cleanup 并脱离父节点。
- [CCObject.cpp:79](../../engine/cocos2d-x-2/cocos2dx/cocoa/CCObject.cpp#L79)：引用计数的 retain/release；[ccCArray.2/cocos2dx/support/data_support/ccCArray.cpp:194](../../engine/cocos2d-x-2/cocos2dx/support/data_support/ccCArray.cpp#L194)：子节点容器移除元素时释放容器持有的引用。

## 简化与运行

用精简的 `CCObject` 表示本代引用计数基类，把 CCArray 对子节点的持有和移除时的释放写在精简 `CCNode` 中；不实现对象池、自动释放池、动作或调度系统。

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/cocoa/CCObject.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/cocos2d-x-2-s21
/tmp/cocos2d-x-2-s21
~~~

输出中先看到 cleanup，再看到析构；EnemyB 会在移除后保留引用计数 1，直到最后一次 release。
