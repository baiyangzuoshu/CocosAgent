# 第 32 课：节点池的后进先出顺序

**目标：** 看清节点池按什么顺序返回已回收的节点。

## 本课增量

点击“观察节点池取出顺序”。示例按 A、B 的顺序调用 `put()`，随后连续调用两次 `get()`；结果是 B、A。Creator 的 NodePool 用数组保存节点，并从数组尾部取出，因此表现为后进先出（LIFO）。

代码入口：[main.ts](src/main.ts)、[CCNodePool.ts](src/extensions/ccpool/CCNodePool.ts)。

## 源码位置

- [CCNodePool.js:147](../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L147)：`get()` 取数组最后一项。
- 本课裁剪代码：`src/extensions/ccpool/CCNodePool.ts` 中的 `get()` 读取末项后缩短数组长度，保留相同的尾部取出逻辑。

## 简化与运行

本课只观察池内顺序，不挂载节点、不绘制对象。LIFO 是当前数组实现的行为；业务逻辑若要求固定顺序，应由应用层明确管理。

~~~sh
deno task check
deno task build
deno task serve
~~~
