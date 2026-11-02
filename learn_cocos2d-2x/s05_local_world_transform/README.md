# 第 5 课：本地位置与世界位置

**目标：** 沿父链合成本地平移，算出 Player 和 Weapon 的世界位置。

## 源码位置

- `engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp:301`：CCNode::setPosition()：设置本地位置。
- `engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp:1146`：CCNode::nodeToParentTransform()：生成到父空间的仿射变换。
- `engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp:1239`：CCNode::nodeToWorldTransform()：沿父链组合变换。

## 本课代码

代码放在 `src/`，目录按 `engine/cocos2d-x-2/` 镜像。子节点容器用 std::vector 代替 CCArray，但保留插入时 retain、移除或析构时 release。PoolManager、池数组和 autorelease 计数折叠成一个 pool 的入队/clear。

## 观察结果

Player 的本地位置为 (12, 7)，世界位置为 (112, 57)；Weapon 世界位置为 (114, 58)。

## 编译运行

在本课目录执行：

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/cocoa/CCObject.cpp src/cocos2dx/cocoa/CCAutoreleasePool.cpp src/cocos2dx/base_nodes/CCNode.cpp src/cocos2dx/layers_scenes_transitions_nodes/CCScene.cpp -o /tmp/cocos2d-2x-s05
/tmp/cocos2d-2x-s05
~~~

这是本课自己的精简实现；没有编译或调用完整引擎。
