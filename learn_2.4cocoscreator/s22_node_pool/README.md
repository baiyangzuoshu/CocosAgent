# 第 22 课：NodePool 节点复用

**目标：** 把节点放入池中暂存，再取回同一个节点继续使用。

## 本课增量

点击“回收 EnemyA”：节点从场景移除，池大小变为 1；组件收到 `onDisable`，但没有 `onDestroy`。点击“取回 EnemyA”：池返回同一节点，重新挂载后再次收到 `onEnable`，`onLoad` 和 `start` 不重复。最后可清空对象池，让池内节点进入销毁队列。

代码入口：[main.ts](src/main.ts)、[CCNodePool.ts](src/extensions/ccpool/CCNodePool.ts)、[base-node.ts](src/cocos2d/core/utils/base-node.ts)、[CCObject.ts](src/cocos2d/core/platform/CCObject.ts)。

## 源码位置

- [CCNodePool.js:100](../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L100)：`clear()` 销毁池内节点。
- [CCNodePool.js:121](../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L121)：`put()` 将节点无 cleanup 地移出父节点并存入池；[CCNodePool.js:147](../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L147)：`get()` 从池中取回节点。

## 简化与运行

只实现 `put/get/size/clear`，省略 `poolHandlerComp` 的 `unuse/reuse` 重置回调。池清空时调用 `destroy()`，实际销毁仍由 Director 帧末处理。

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。等 EnemyA 的 `start` 后，依次点“回收 EnemyA”和“取回 EnemyA”，观察对象池大小、同一节点的生命周期记录；需要时点“清空对象池”。
