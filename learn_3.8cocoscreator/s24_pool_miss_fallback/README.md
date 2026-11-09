# 第 24 课：对象池未命中与 Prefab 兜底

**目标：** 池中没有可用节点时，创建一个新实例继续运行。

## 本课增量

点击“从池取出；未命中则新建”。池中有节点时，`get(45)` 取回并复用同一对象；池为空时返回 `null`，示例调用 `instantiate(enemyPrefab)` 创建新节点。新实例使用初始 HP，不会调用池处理组件的 `reuse()`。

代码入口：[main.ts](src/main.ts)、[node-pool.ts](src/extensions/ccpool/node-pool.ts)、[instantiate.ts](src/cocos/serialization/instantiate.ts)。

## 源码位置

- [node-pool.ts:151](../../engine/3.8.7engine/extensions/ccpool/node-pool.ts#L151)：`get()` 在池为空时返回 `null`（[152–154 行](../../engine/3.8.7engine/extensions/ccpool/node-pool.ts#L152)）。
- [instantiate.ts:105](../../engine/3.8.7engine/cocos/serialization/instantiate.ts#L105)：实例化入口；节点复制调用 `_instantiate()`（[123–129 行](../../engine/3.8.7engine/cocos/serialization/instantiate.ts#L123)）。

## 简化与运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>。先回收 EnemyA，再点取出按钮观察池命中；清空对象池后再次点击，观察新实例的初始状态。
