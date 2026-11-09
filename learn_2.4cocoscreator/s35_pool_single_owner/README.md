# 第 35 课：限制节点同时归属多个池

**目标：** 节点在池中时只由一个 `NodePool` 管理；取出后可以转交给另一个池。

## 本课增量

第34课展示了每个池只检查自己的数组。本课在裁剪版 `NodePool` 模块中增加共享 `WeakMap`：A 池存入节点后，B 池的 `put()` 会被拒绝；节点从 A 池 `get()` 后释放归属，随后 B 池可以接收它。

代码入口：[main.ts](src/main.ts)、[CCNodePool.ts](src/extensions/ccpool/CCNodePool.ts)。

## 源码位置

- [CCNodePool.js:121-133](../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L121)：引擎 `put()` 只检查当前实例的 `_pool`，没有跨池登记。
- [CCNodePool.js:100-105](../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L100)、[147-160](../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L147)：引擎清池和取出路径。
- 本课裁剪代码：`CCNodePool.ts` 用模块共享的 `WeakMap` 记录归属，并在 `get()`、`clear()` 时释放记录。

## 简化与运行

归属表只服务于同一模块实例中的池；不处理多份独立引擎副本之间的共享。

~~~sh
deno task check
deno task build
deno task serve
~~~
