# 第 23 课：容量策略与清池生命周期

**目标：** 把 Creator `NodePool` 提供的存取/回调机制，与应用层预热补充策略和清池销毁时机连起来。

## 本课内容

示例在一条流程中观察 `unuse/reuse`、空池时由调用方实例化 Prefab、容量上限、预热批次、低水位补充和 `clear()`。池只管理节点存取；容量策略由应用代码负责。`clear()` 调用 `destroy()` 后清空数组，实际失效由 Director 后续处理，持有外部引用不会取消销毁请求。节点离开活动层级时组件 `update` 暂停，重新挂载后恢复；`NodePool.put()` 使用 `removeFromParent(false)`，因此不会执行 cleanup 清理。本快照没有建模节点事件系统，cleanup 对监听器的差异只对照源码说明。

代码入口：[main.ts](src/main.ts)、[CCNodePool.ts](src/extensions/ccpool/CCNodePool.ts)、[instantiate.ts](src/cocos2d/core/platform/instantiate.ts)。

## 源码位置

Creator 2.4.15 [NodePool.put/get/clear](../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L91)、[Prefab 实例化](../../engine/2.4.15engine/cocos2d/core/platform/instantiate.js)、[延迟销毁](../../engine/2.4.15engine/cocos2d/core/platform/CCObject.js)。

## 本课必须保留的机制

保留 `unuse/reuse` 的时序、空池 `null` 兜底、调用方容量策略，以及清池与延迟销毁的区别。

## 最小观察宿主

页面按钮可预热、取出或新建、清池；状态区显示池大小、容量、HP、回调和销毁状态。

## 模型化简化与 Creator Runtime 边界

最大容量、预热、补充是课程应用层代码，不是 Creator 原生 `NodePool` API。示例不测真实实例化耗时或资源加载性能。

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，预热后取出观察 `reuse` 与低水位补充，再清池观察延迟销毁。
