# 第 34 课：同一节点跨池共享的风险

**目标：** 看清去重检查只约束当前池，不约束其他 NodePool 实例。

## 本课增量

点击“两个池共享同一节点”。示例把同一个节点分别放入池 A 和池 B。两边各自的 `size()` 都变为 1；分别 `get()` 后，两个结果仍是同一个节点实例。

NodePool 的 `indexOf` 只搜索当前实例的数组，没有跨池所有权登记。应用层应保证节点同一时刻只归一个池管理。

代码入口：[main.ts](src/main.ts)、[node-pool.ts](src/extensions/ccpool/node-pool.ts)。

## 源码位置

- [node-pool.ts:127](../../engine/3.8.7engine/extensions/ccpool/node-pool.ts#L127)：`put()` 只在 `this._pool` 中检查节点身份。
- 本课裁剪代码：两个 NodePool 实例各自维护自己的数组，并复现跨池取回同一实例。

## 简化与运行

示例不实现全局所有权表，只展示 NodePool 自身的去重范围；点击按钮后可观察两池都能返回同一对象。

~~~sh
deno task check
deno task build
deno task serve
~~~
