# 第 20 课：节点移除与重新挂载

**目标：** 观察实例离开活动场景时的停用，以及重新挂载时的启用。

## 本课增量

第 19 课的 EnemyA 已执行 `onLoad → onEnable → start` 后，点击“移除 EnemyA”：组件记录 `onDisable`。再点击“重新挂载 EnemyA”：记录新的 `onEnable`，已执行过的 `onLoad` 和 `start` 不重复。EnemyB 保持在场景中。

代码入口：[main.ts](src/main.ts)、[base-node.ts](src/cocos2d/core/utils/base-node.ts)、[node-activator.ts](src/cocos2d/core/node-activator.ts)。

## 源码位置

- [base-node.js:709](../../engine/2.4.15engine/cocos2d/core/utils/base-node.js#L709)：`removeChild` 把子节点的父节点设为空；[base-node.js:1172](../../engine/2.4.15engine/cocos2d/core/utils/base-node.js#L1172) 按新父节点状态决定激活或停用。
- [node-activator.js:203](../../engine/2.4.15engine/cocos2d/core/node-activator.js#L203)：递归停用子树中的组件。
- [component-scheduler.js:424](../../engine/2.4.15engine/cocos2d/core/component-scheduler.js#L424)：派发 `onDisable` 并取消调度；[node-activator.js:329](../../engine/2.4.15engine/cocos2d/core/node-activator.js#L329) 保存首次加载标记。

## 简化与运行

只实现 `removeChild(child, false)`，不实现 `cleanup=true` 的动作和事件清理，也不涉及销毁。按钮等第一次 `start` 后才可用。

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，依次点击移除和重新挂载，观察 EnemyA 的回调记录。
