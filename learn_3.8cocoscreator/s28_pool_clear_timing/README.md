# 第 28 课：对象池 clear 的销毁时机

**目标：** 区分对象池立即清空与节点实际销毁的时机。

## 本课增量

点击“观察 clear 的销毁时机”。Creator 的 `NodePool.clear()` 立刻将池大小变为 0，但它对节点调用 `destroy()`；Web 运行时的 Director 在本帧更新结束时处理销毁队列。界面保留 `clear()` 返回时的快照，并继续显示当前 `isValid` 与 `onDestroy`。

Cocos2d-x 没有内置 `NodePool`。本课应用层池在 `clear()` 中释放池持有的引用；如果该引用是最后一个，对象会在 `clear()` 返回前析构。

代码入口：[main.ts](src/main.ts)、[node-pool.ts](src/extensions/ccpool/node-pool.ts)、[object.ts](src/cocos/core/data/object.ts)、[director.ts](src/cocos/game/director.ts)。

## 源码位置

- [node-pool.ts:106](../../engine/3.8.7engine/extensions/ccpool/node-pool.ts#L106)：清空池数组并对节点调用 `destroy()`。
- [object.ts:300](../../engine/3.8.7engine/cocos/core/data/object.ts#L300)：将 `destroy()` 请求加入延迟队列；[director.ts:790](../../engine/3.8.7engine/cocos/game/director.ts#L790) 在更新结束时处理队列。
- Cocos2d-x 1.x/2.x 的引用归零删除见 [CCObject.cpp:74](../../engine/cocos2d-x-1/cocos2dx/cocoa/CCObject.cpp#L74) 和 [CCObject.cpp:79](../../engine/cocos2d-x-2/cocos2dx/cocoa/CCObject.cpp#L79)；3.x/4.x 见 [CCRef.cpp:97](../../engine/cocos2d-x-3/cocos/base/CCRef.cpp#L97) 与 [CCRef.cpp:97](../../engine/cocos2d-x-4/cocos/base/CCRef.cpp#L97)。

## 简化与运行

保留 `NodePool.clear()`、对象销毁队列和 Director 帧末刷新；省略编辑器态自动刷新与完整资源清理。

~~~sh
deno task check
deno task build
deno task serve
~~~

点击按钮：即时快照应显示 `size=0`、`isValid=true`、`onDestroy=false`；随后帧末状态变为无效并记录 `onDestroy`。
