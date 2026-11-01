# 第 5 课：本地位置与世界位置

**目标：** 看清节点的本地位置怎样经过父节点变换得到世界位置。

## 本课增量

`Node` 的 `_lpos` 保存本地位置，`worldPosition` 通过更新世界变换得到。示例先只处理平移：Canvas `(100, 50, 0)`、Player `(12, 7, 0)`，Player 世界位置为 `(112, 57, 0)`。

## 源码位置

- `engine/3.8.7engine/cocos/scene-graph/node.ts:1627`：`_lpos` 保存本地位置。
- `engine/3.8.7engine/cocos/scene-graph/node.ts:1740`：`worldPosition` 先调用 `updateWorldTransform()`。
- `engine/3.8.7engine/cocos/scene-graph/node.ts:2311`、`engine/3.8.7engine/cocos/scene-graph/node.ts:2338`：根据父节点世界矩阵更新节点世界变换。
- `engine/3.8.7engine/cocos/scene-graph/node.ts:2422`、`engine/3.8.7engine/cocos/scene-graph/node.ts:2435`：`setPosition()` 写入本地位置并标记后代变换需要更新。

## 观察结果

页面显示 Player 本地位置 `(12, 7, 0)`、世界位置 `(112, 57, 0)`，以及 Weapon 世界位置 `(114, 58, 0)`。

## 简化

课程直接累加父链平移。旋转、缩放、斜切、矩阵缓存和变换脏标记尚未实现；它们留待后续课程。

## 运行

在本课目录运行 `deno task check`、`deno task build` 和 `deno task serve`，然后打开 <http://localhost:8000>。

## 同主题课程

- [Creator 2.4.15：本地位置与世界位置](../../learn_2.4cocoscreator/s05_local_world_transform/README.md)
- [Cocos2d-x 4.0：本地位置与世界位置](../../learn_cocos2d-4x/s05_local_world_transform/README.md)
