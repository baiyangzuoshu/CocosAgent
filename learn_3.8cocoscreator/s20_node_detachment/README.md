# 第 20 课：节点移除与重新挂载

**目标：** 观察实例离开活动场景时的停用，以及重新挂载时的启用。

## 本课增量

第 19 课的 EnemyA 已执行 `onLoad → onEnable → start` 后，点击“移除 EnemyA”：组件记录 `onDisable`。再点击“重新挂载 EnemyA”：记录新的 `onEnable`，已执行过的 `onLoad` 和 `start` 不重复。EnemyB 保持在场景中。

代码入口：[main.ts](src/main.ts)、[node.ts](src/cocos/scene-graph/node.ts)、[node-activator.ts](src/cocos/scene-graph/node-activator.ts)。

## 源码位置

- [node.ts:805](../../engine/3.8.7engine/cocos/scene-graph/node.ts#L805)：`removeChild` 把子节点的父节点设为空；[node.ts:1487](../../engine/3.8.7engine/cocos/scene-graph/node.ts#L1487) 按新父节点状态决定激活或停用。
- [node-activator.ts:288](../../engine/3.8.7engine/cocos/scene-graph/node-activator.ts#L288)：递归停用子树中的组件。
- [component-scheduler.ts:460](../../engine/3.8.7engine/cocos/scene-graph/component-scheduler.ts#L460)：派发 `onDisable` 并取消调度；[node-activator.ts:210](../../engine/3.8.7engine/cocos/scene-graph/node-activator.ts#L210) 保存首次加载标记。

## 简化与运行

只演示活动场景中的移除和重新挂载，不涉及销毁或回调期间修改节点树。按钮等第一次 `start` 后才可用。

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，依次点击移除和重新挂载，观察 EnemyA 的回调记录。
