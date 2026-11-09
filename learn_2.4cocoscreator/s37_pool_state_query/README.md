# 第 37 课：区分空池与已关闭池

**目标：** 看懂 `get()` 都返回 `null` 时，如何判断对象池是否已经进入终态。

## 本课增量

空池和已关闭池的 `get()` 都返回 `null`。本课增加只读方法 `isDisposed()`，让调用方查询终态标志；浏览器演示并排比较两种状态。

代码入口：[main.ts](src/main.ts)、[CCNodePool.ts](src/extensions/ccpool/CCNodePool.ts)。

## 源码位置

- [CCNodePool.js:91-93](../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L91)：引擎 `size()` 只报告池中数量。
- [CCNodePool.js:147-160](../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L147)：引擎 `get()` 对空池返回 `null`；它没有终态标志。
- 本课裁剪代码：`CCNodePool.ts` 的 `_disposed` 与 `isDisposed()`；终态在第 36 课的 `dispose()` 中设置。

## 简化与运行

`isDisposed()` 只查询状态，不改变池的行为。

~~~sh
deno task check
deno task build
deno task serve
~~~
