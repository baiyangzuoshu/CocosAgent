# 第 28 课：节点池所有权与接收结果

**目标：** 限制节点跨池归属，并让调用方知道 put 是否被接受。

## 本课内容

共享 `WeakMap` 登记节点归属；只有实际入池返回 `true`，重复或跨池冲突返回 `false`。

代码入口：[main.ts](src/main.ts)、[CCNodePool.ts](src/extensions/ccpool/CCNodePool.ts)。

## 源码位置

- 引擎 [put()](<../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L121>) 只检查单池；本课在 [CCNodePool.js](<src/extensions/ccpool/CCNodePool.ts>) 加入归属表和布尔返回。

## 本课必须保留的机制

保留共享 `WeakMap` 对节点池归属的登记；只有实际接收节点的池返回 `true`，重复或跨池冲突返回 `false`。

## 最小观察宿主

使用两个池和一个节点，依次执行入池、重复入池与跨池转交，通过返回值和日志观察所有权变化。

## 模型化简化与 Creator Runtime 边界

跨池所有权表是课程应用层扩展；Creator `NodePool` 只维护本池数组，不提供全局所有者登记。此模型不覆盖真实场景节点管理或渲染。

~~~sh
deno task check
deno task build
deno task serve
~~~
