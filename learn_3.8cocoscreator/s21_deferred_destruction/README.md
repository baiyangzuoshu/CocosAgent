# 第 21 课：延迟销毁与 onDestroy

**目标：** 看清 `destroy()` 请求和实际销毁发生在不同时间。

## 本课增量

点击“销毁 EnemyB”。调用后 `isValid` 仍为 `true`；Director 在本帧更新结束时处理销毁队列，随后组件记录 `onDisable → onDestroy`，节点变为无效。EnemyA 仍可按上一课移除后重新挂载。

代码入口：[main.ts](src/main.ts)、[object.ts](src/cocos/core/data/object.ts)、[node.ts](src/cocos/scene-graph/node.ts)、[component.ts](src/cocos/scene-graph/component.ts)、[director.ts](src/cocos/game/director.ts)。

## 源码位置

- [object.ts:173](../../engine/3.8.7engine/cocos/core/data/object.ts#L173)：处理待销毁队列；[object.ts:300](../../engine/3.8.7engine/cocos/core/data/object.ts#L300) 将 `destroy()` 请求入队。
- [director.ts:786](../../engine/3.8.7engine/cocos/game/director.ts#L786)：更新阶段结束后刷新销毁队列。
- [node.ts:1367](../../engine/3.8.7engine/cocos/scene-graph/node.ts#L1367)：节点请求销毁时立即停用；[node.ts:1493](../../engine/3.8.7engine/cocos/scene-graph/node.ts#L1493) 销毁子节点和组件。
- [component.ts:379](../../engine/3.8.7engine/cocos/scene-graph/component.ts#L379)：组件销毁时停用；[component.ts:405](../../engine/3.8.7engine/cocos/scene-graph/component.ts#L405) 在实际销毁阶段处理 `onDestroy`。

## 简化与运行

只保留待销毁队列、帧末刷新、节点子树清理和组件回调；省略对象池、编辑器撤销和完整资源引用清理。

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。先等两个 Enemy 的 `start`，再点“销毁 EnemyB”，观察调用后和下一帧的 `isValid` 与回调记录。
