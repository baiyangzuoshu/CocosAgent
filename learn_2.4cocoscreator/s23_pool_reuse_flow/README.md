# 第 23 课：对象池复用与未命中兜底

**目标：** 回收节点时重置状态；池未命中时创建新实例。

## 本课内容

`put()` 先运行 `unuse()`；`get()` 取回时运行 `reuse()`。池为空则返回 `null`，由调用方实例化新节点。

代码入口：[main.ts](src/main.ts)、[CCNodePool.ts](src/extensions/ccpool/CCNodePool.ts)。

## 源码位置

- 引擎入口：[put()](<../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L121>)、[get()](<../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L147>)；[Prefab 实例化](<../../engine/2.4.15engine/cocos2d/core/platform/instantiate.js>).

## 本课必须保留的机制

保留 `put()` 时组件 `unuse()`、`get()` 时 `reuse()` 的回调顺序；池空返回 `null`，由调用方走 Prefab 实例化兜底。

## 最小观察宿主

用少量回收/取回按钮和日志观察回调及空池分支；页面不展示前课的输入、资源或渲染状态。

## 模型化简化与 Creator Runtime 边界

本目录是独立代码快照；本地 NodePool 只模拟本课的 put/get 与 handler 行为，空池创建由应用层实现，不包含完整 Creator 组件发现、Prefab/Asset 管线或渲染流程。

~~~sh
deno task check
deno task build
deno task serve
~~~
