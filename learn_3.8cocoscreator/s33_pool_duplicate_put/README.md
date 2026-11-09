# 第 33 课：防止节点重复入池

**目标：** 确保一个节点在同一个池中只占一个位置。

## 本课增量

点击“重复 put 同一节点”。示例对 A 连续调用两次 `put()`：池大小仍为 1；第一次 `get()` 返回 A，第二次返回 `null`。若同一节点被重复存入，池可能把同一实例发给两个调用方。

代码入口：[main.ts](src/main.ts)、[node-pool.ts](src/extensions/ccpool/node-pool.ts)。

## 源码位置

- [node-pool.ts:127](../../engine/3.8.7engine/extensions/ccpool/node-pool.ts#L127)：`put()` 通过 `indexOf` 检查同一实例是否已在池内。
- 本课裁剪代码：`src/extensions/ccpool/node-pool.ts` 中以 `indexOf(node)` 拒绝重复实例。

## 简化与运行

本课只演示同一个池内的重复检查；不处理一个节点被错误地放入两个不同池的情况。

~~~sh
deno task check
deno task build
deno task serve
~~~
