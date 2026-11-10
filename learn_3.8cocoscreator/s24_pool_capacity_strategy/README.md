# 第 24 课：对象池容量与预热补充

**目标：** 控制池容量，并用预热和低水位补充平衡创建时机。

## 本课内容

容量、预热和补充都由应用层维护；`NodePool` 只负责存放、取出节点。

代码入口：[main.ts](src/main.ts)、[node-pool.ts](src/extensions/ccpool/node-pool.ts)。

## 源码位置

- 引擎提供 [size/put/get](<../../engine/3.8.7engine/extensions/ccpool/node-pool.ts#L98>) 与 [实例化入口](<../../engine/3.8.7engine/cocos/serialization/instantiate.ts>)；容量和补货策略由应用层实现。

## 简化与运行

本目录是独立代码快照；引擎没有提供的策略由课程应用层实现。

~~~sh
deno task check
deno task build
deno task serve
~~~
