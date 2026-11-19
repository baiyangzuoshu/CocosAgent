# 第 29 课：对象池关闭与终态

**目标：** 关闭对象池、查询终态，并保证重复关闭安全。

## 本课内容

第一次 `dispose()` 清池并设置终态；之后的 `put()` 拒绝、`get()` 返回空，重复关闭不改变结果。

代码入口：[main.ts](src/main.ts)、[CCNodePool.ts](src/extensions/ccpool/CCNodePool.ts)。

## 源码位置

- 引擎 [clear()](<../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L100>) 不表示关闭；本课在 [CCNodePool.js](<src/extensions/ccpool/CCNodePool.ts>) 增加 `dispose/isDisposed` 与接收结果。

## 本课必须保留的机制

保留一次性 `dispose()` 清空池并进入终态；终态下 `put()` 被拒绝、`get()` 返回空，重复关闭不改变状态。

## 最小观察宿主

用一个池、一个待销毁节点、关闭按钮和状态日志观察清理前后及后续调用结果；Director 帧循环负责处理销毁队列。

## 模型化简化与 Creator Runtime 边界

`dispose/isDisposed` 是课程应用层扩展，不是引擎 NodePool 原生 API；本课只模型化关闭后的终态和拒绝策略，不包含引擎的完整资源析构。

~~~sh
deno task check
deno task build
deno task serve
~~~
