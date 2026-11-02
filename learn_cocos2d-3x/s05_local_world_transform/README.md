# 第 5 课：本地位置与世界位置

**目标：** 沿父链合成本地平移，算出 Player 和 Weapon 的世界位置。

## 源码位置

- `engine/cocos2d-x-3/cocos/2d/CCNode.cpp:506`：Node::setPosition()：设置本地位置。
- `engine/cocos2d-x-3/cocos/2d/CCNode.cpp:1709`：Node::getNodeToParentTransform()：生成到父空间的矩阵。
- `engine/cocos2d-x-3/cocos/2d/CCNode.cpp:1881`：Node::getNodeToWorldTransform()：沿父链组合矩阵。

## 本课代码

代码放在 `src/`，目录按 `engine/cocos2d-x-3/` 镜像。子节点容器用 std::vector 代替 cocos2d::Vector，但保留插入时 retain、移除或析构时 release。PoolManager 折叠成一个当前 pool。

## 观察结果

Player 的本地位置为 (12, 7)，世界位置为 (112, 57)；Weapon 世界位置为 (114, 58)。

## 编译运行

在本课目录执行：

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/base/CCRef.cpp src/cocos/base/CCAutoreleasePool.cpp src/cocos/2d/CCNode.cpp src/cocos/2d/CCScene.cpp -o /tmp/cocos2d-3x-s05
/tmp/cocos2d-3x-s05
~~~

这是本课自己的精简实现；没有编译或调用完整引擎。
