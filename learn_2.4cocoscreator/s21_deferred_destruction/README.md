# 第 21 课：延迟销毁与 onDestroy

**目标：** 看清 `destroy()` 请求和实际销毁发生在不同时间。

## 本课增量

点击“销毁 EnemyB”。调用后 `isValid` 仍为 `true`；Director 在本帧更新结束时处理销毁队列，随后组件记录 `onDisable → onDestroy`，节点变为无效。EnemyA 仍可按上一课移除后重新挂载。

代码入口：[main.ts](src/main.ts)、[CCObject.ts](src/cocos2d/core/platform/CCObject.ts)、[base-node.ts](src/cocos2d/core/utils/base-node.ts)、[CCComponent.ts](src/cocos2d/core/components/CCComponent.ts)、[CCDirector.ts](src/cocos2d/core/CCDirector.ts)。

## 源码位置

- [CCObject.js:196](../../engine/2.4.15engine/cocos2d/core/platform/CCObject.js#L196)：收集待销毁对象；[CCObject.js:305](../../engine/2.4.15engine/cocos2d/core/platform/CCObject.js#L305) 将 `destroy()` 请求加入队列；[CCObject.js:490](../../engine/2.4.15engine/cocos2d/core/platform/CCObject.js#L490) 执行实际销毁。
- [CCDirector.js:899](../../engine/2.4.15engine/cocos2d/core/CCDirector.js#L899)：更新阶段结束后刷新销毁队列。
- [base-node.js:1232](../../engine/2.4.15engine/cocos2d/core/utils/base-node.js#L1232)：销毁节点时处理子节点和组件；[CCComponent.js:503](../../engine/2.4.15engine/cocos2d/core/components/CCComponent.js#L503) 与 [node-activator.js:363](../../engine/2.4.15engine/cocos2d/core/node-activator.js#L363)：组件销毁并派发 `onDestroy`。

## 简化与运行

只保留待销毁队列、帧末刷新、节点子树清理和组件回调；省略对象池、编辑器撤销和完整资源引用清理。

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。先等两个 Enemy 的 `start`，再点“销毁 EnemyB”，观察调用后和下一帧的 `isValid` 与回调记录。
