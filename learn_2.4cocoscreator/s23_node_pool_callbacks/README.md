# 第 23 课：NodePool 回收与复用回调

**目标：** 在节点入池时清理临时状态，取出时重新初始化。

## 本课增量

等 EnemyA 启动后点“回收”：节点触发 `onDisable`，随后池处理组件的 `unuse()` 将 HP 清零并关闭临时效果。点“取回”：`get(45)` 先调用 `reuse(45)`，再把同一节点挂回场景；组件收到 `onEnable`。清池仍会销毁节点。

代码入口：[main.ts](src/main.ts)、[CCNodePool.ts](src/extensions/ccpool/CCNodePool.ts)、[base-node.ts](src/cocos2d/core/utils/base-node.ts)。

## 源码位置

- [CCNodePool.js:121](../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L121)：`put()` 移除节点后查找处理组件并调用 `unuse()`（[127–132 行](../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L127)）。
- [CCNodePool.js:147](../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L147)：`get()` 取出节点并用 `reuse.apply(handler, arguments)` 转发参数（[158–160 行](../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L158)）。
- [base-node.js:793](../../engine/2.4.15engine/cocos2d/core/utils/base-node.js#L793)：按组件构造器查找池处理组件。

## 简化与运行

本例只支持用组件构造器指定 `poolHandlerComp`，省略组件名字符串查找。`unuse` 在移出父节点后调用，`reuse` 在 `get` 返回前调用。

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，观察生命周期顺序及 HP、临时效果在回收和取回时的变化。
