# 第 23 课：对象池复用与未命中兜底

**目标：** 回收节点时重置状态；池未命中时创建新实例。

## 本课内容

`put()` 先运行 `unuse()`；`get()` 取回时运行 `reuse()`。池为空则返回 `null`，由调用方实例化新节点。

代码入口：[main.ts](src/main.ts)、[CCNodePool.ts](src/extensions/ccpool/CCNodePool.ts)。

## 源码位置

- 引擎入口：[put()](<../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L121>)、[get()](<../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L147>)；[Prefab 实例化](<../../engine/2.4.15engine/cocos2d/core/platform/instantiate.js>).

## 简化与运行

本目录是独立代码快照；引擎没有提供的策略由课程应用层实现。

~~~sh
deno task check
deno task build
deno task serve
~~~
