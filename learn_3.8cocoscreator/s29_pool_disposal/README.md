# 第 29 课：对象池关闭与终态

**目标：** 关闭对象池、查询终态，并保证重复关闭安全。

## 本课内容

第一次 `dispose()` 清池并设置终态；之后的 `put()` 拒绝、`get()` 返回空，重复关闭不改变结果。

代码入口：[main.ts](src/main.ts)、[node-pool.ts](src/extensions/ccpool/node-pool.ts)。

## 源码位置

- 引擎 [clear()](<../../engine/3.8.7engine/extensions/ccpool/node-pool.ts#L106>) 不表示关闭；本课在 [node-pool.ts](<src/extensions/ccpool/node-pool.ts>) 增加 `dispose/isDisposed` 与接收结果。

## 简化与运行

本目录是独立代码快照；引擎没有提供的策略由课程应用层实现。

~~~sh
deno task check
deno task build
deno task serve
~~~
