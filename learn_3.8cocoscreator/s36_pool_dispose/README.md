# 第 36 课：对象池 dispose 后禁止继续使用

**目标：** 区分可复用的 `clear()` 与终态的 `dispose()`。

## 本课增量

引擎 `NodePool.clear()` 会清空并销毁池内节点，但池实例仍可再次 `put()`。本课增加 `_disposed` 状态：`dispose()` 先关闭池，再调用 `clear()`；此后 `put()` 被忽略，`get()` 返回 `null`。按钮保留外部节点引用，观察关闭前后行为。

代码入口：[main.ts](src/main.ts)、[node-pool.ts](src/extensions/ccpool/node-pool.ts)。

## 源码位置

- [node-pool.ts:106-112](../../engine/3.8.7engine/extensions/ccpool/node-pool.ts#L106)：引擎提供清池，但没有关闭状态或 `dispose()`。
- [node-pool.ts:126-168](../../engine/3.8.7engine/extensions/ccpool/node-pool.ts#L126)：引擎 `put/get` 路径；本课在它们之前检查终态。
- 本课裁剪代码：`node-pool.ts` 中 `_disposed`、`dispose()`、`put()` 和 `get()`。

## 简化与运行

`clear()` 保持可复用；只有显式调用 `dispose()` 才进入终态。

~~~sh
deno task check
deno task build
deno task serve
~~~
