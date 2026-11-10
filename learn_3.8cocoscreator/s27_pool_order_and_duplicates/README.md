# 第 27 课：取出顺序与重复入池保护

**目标：** 看清节点取出顺序，并阻止同一节点重复占用池位置。

## 本课内容

数组尾部实现 LIFO；重复 `put()` 被身份检查拒绝。

代码入口：[main.ts](src/main.ts)、[node-pool.ts](src/extensions/ccpool/node-pool.ts)。

## 源码位置

- 引擎 [get()](<../../engine/3.8.7engine/extensions/ccpool/node-pool.ts#L151>) 从数组尾部取出；重复保护位于本课裁剪版 `put()`。

## 简化与运行

本目录是独立代码快照；引擎没有提供的策略由课程应用层实现。

~~~sh
deno task check
deno task build
deno task serve
~~~
