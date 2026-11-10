# 第 28 课：节点池所有权与接收结果

**目标：** 限制节点跨池归属，并让调用方知道 put 是否被接受。

## 本课内容

共享 `WeakMap` 登记节点归属；只有实际入池返回 `true`，重复或跨池冲突返回 `false`。

代码入口：[main.ts](src/main.ts)、[CCNodePool.ts](src/extensions/ccpool/CCNodePool.ts)。

## 源码位置

- 引擎 [put()](<../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L121>) 只检查单池；本课在 [CCNodePool.js](<src/extensions/ccpool/CCNodePool.ts>) 加入归属表和布尔返回。

## 简化与运行

本目录是独立代码快照；引擎没有提供的策略由课程应用层实现。

~~~sh
deno task check
deno task build
deno task serve
~~~
