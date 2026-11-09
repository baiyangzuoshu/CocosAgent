# 第 30 课：池中节点暂停调度

**目标：** 看清节点仍被对象池保留时，组件的 `update` 是否继续运行。

## 本课增量

点击“观察池内更新是否暂停”。示例先统计节点在场景中的 `update`，再将它放入 `NodePool`。节点从活动层级移除后，池内经过的帧数增加，但 `update` 次数不变；`get()` 取回并重新挂入场景后，`update` 恢复。

这说明“对象仍存活”和“组件仍参与帧调度”是两件事。`unuse/reuse` 负责池化状态，层级激活状态决定组件是否进入更新调度。

代码入口：[main.ts](src/main.ts)、[node-pool.ts](src/extensions/ccpool/node-pool.ts)、[node.ts](src/cocos/scene-graph/node.ts)、[component-scheduler.ts](src/cocos/scene-graph/component-scheduler.ts)。

## 源码位置

- [node-pool.ts:126](../../engine/3.8.7engine/extensions/ccpool/node-pool.ts#L126)：`put()` 将节点移出父节点但不销毁。
- [node.ts:1487](../../engine/3.8.7engine/cocos/scene-graph/node.ts#L1487)：父节点变化后更新层级激活状态。
- [component-scheduler.ts:72](../../engine/3.8.7engine/cocos/scene-graph/component-scheduler.ts#L72)：非活动层级的组件会从调度列表移除。

## 简化与运行

保留 `NodePool.put/get`、层级激活和组件更新调度；省略完整对象池管理与动画系统。

~~~sh
deno task check
deno task build
deno task serve
~~~

点击按钮：池内若干帧的更新增量应为 0；节点重新挂载后更新继续增加。
