# 第 11 课：变换脏标记与子树失效

**目标：** 看清父节点移动后，子节点的世界位置如何延迟重算。

## 本课增量

节点位置变化会使自己和后代的世界变换失效。读取 `worldPosition` 时，引擎从祖先向下更新脏变换；未变化时复用缓存。示例第 2 帧移动 Branch，并观察 Player 的世界位置和重算次数。

## 源码位置

- `engine/3.8.7engine/cocos/scene-graph/node.ts:2279-2304`：`invalidateChildren` 将变换标记传播给后代。
- `engine/3.8.7engine/cocos/scene-graph/node.ts:2311-2344`：`updateWorldTransform` 按祖先顺序更新世界变换。
- `engine/3.8.7engine/cocos/scene-graph/node.ts:2422-2438`：`setPosition` 触发位置变换失效。

## 简化

只缓存平移世界位置；省略矩阵、旋转、缩放、斜切、跳过更新标记和变换变更事件。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，观察父节点移动后子节点世界位置改变，而未变化时重算次数保持不变。
