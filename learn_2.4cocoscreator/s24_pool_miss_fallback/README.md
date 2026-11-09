# 第 24 课：对象池未命中与 Prefab 兜底

**目标：** 池中没有可用节点时，创建一个新实例继续运行。

## 本课增量

点击“从池取出；未命中则新建”。池中有节点时，`get(45)` 取回并复用同一对象；池为空时返回 `null`，示例调用 `instantiate(enemyPrefab)` 创建新节点。新实例使用初始 HP，不会调用池处理组件的 `reuse()`。

代码入口：[main.ts](src/main.ts)、[CCNodePool.ts](src/extensions/ccpool/CCNodePool.ts)、[instantiate.ts](src/cocos2d/core/platform/instantiate.ts)。

## 源码位置

- [CCNodePool.js:147](../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L147)：`get()` 在池为空时返回 `null`（[149–151 行](../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L149)）。
- [instantiate.js:56](../../engine/2.4.15engine/cocos2d/core/platform/instantiate.js#L56)：实例化 Prefab/节点；复制入口在 [89–93 行](../../engine/2.4.15engine/cocos2d/core/platform/instantiate.js#L89)。

## 简化与运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。先回收 EnemyA，再点取出按钮观察池命中；清空对象池后再次点击，观察新实例的初始状态。
