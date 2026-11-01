# 第 5 课：本地位置与世界位置

**目标：** 看清节点在父坐标系中的位置怎样沿父链组合成世界位置。

## 本课增量

在 `Node` 中加入本地 `Vec2` 位置。示例只计算平移：Canvas `(100, 50)`、Player `(12, 7)`，Player 世界位置为 `(112, 57)`；Weapon 本地位置 `(2, 1)`，世界位置为 `(114, 58)`。

## 源码位置

- `engine/cocos2d-x-4/cocos/2d/CCNode.h:333`、`engine/cocos2d-x-4/cocos/2d/CCNode.cpp:512`：`setPosition()` 设置相对于父节点的本地位置。
- `engine/cocos2d-x-4/cocos/2d/CCNode.cpp:1658`：`getNodeToParentTransform()` 生成节点到父节点空间的矩阵。
- `engine/cocos2d-x-4/cocos/2d/CCNode.cpp:1637`：遍历祖先并组合节点变换。
- `engine/cocos2d-x-4/cocos/2d/CCNode.cpp:1840`：`getNodeToWorldTransform()` 返回节点的世界变换。

## 观察结果

终端打印场景树、本地位置和世界位置。位置依次为 Player `(12, 7)`、`(112, 57)`，Weapon 世界位置 `(114, 58)`。

## 简化

课程用父链逐级相加表示平移组合。引擎实际生成并组合变换矩阵，还处理旋转、缩放、倾斜、锚点和脏标记；本课省略这些部分。

## 运行

在本课目录运行：

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/base/CCRef.cpp src/cocos/2d/CCNode.cpp src/cocos/2d/CCScene.cpp -o /tmp/cocos2d-x-s05
/tmp/cocos2d-x-s05
~~~

课程代码独立运行，不依赖其他课程或 Cocos2d-x 构建产物。

## 同主题课程

- [Creator 2.4.15：本地位置与世界位置](../../learn_2.4cocoscreator/s05_local_world_transform/README.md)
- [Creator 3.8.7：本地位置与世界位置](../../learn_3.8cocoscreator/s05_local_world_transform/README.md)
