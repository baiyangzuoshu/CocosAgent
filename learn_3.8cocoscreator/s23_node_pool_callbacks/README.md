# 第 23 课：NodePool 回收与复用回调

**目标：** 在节点入池时清理临时状态，取出时重新初始化。

## 本课增量

等 EnemyA 启动后点“回收”：节点触发 `onDisable`，随后池处理组件的 `unuse()` 将 HP 清零并关闭临时效果。点“取回”：`get(45)` 将参数交给 `reuse(args)`，再把同一节点挂回场景；组件收到 `onEnable`。清池仍会销毁节点。

代码入口：[main.ts](src/main.ts)、[node-pool.ts](src/extensions/ccpool/node-pool.ts)、[node.ts](src/cocos/scene-graph/node.ts)。

## 源码位置

- [node-pool.ts:126](../../engine/3.8.7engine/extensions/ccpool/node-pool.ts#L126)：`put()` 移除节点后查找处理组件并调用 `unuse()`（[133–138 行](../../engine/3.8.7engine/extensions/ccpool/node-pool.ts#L133)）。
- [node-pool.ts:151](../../engine/3.8.7engine/extensions/ccpool/node-pool.ts#L151)：`get()` 取出节点并把 `arguments` 交给 `reuse()`（[160–165 行](../../engine/3.8.7engine/extensions/ccpool/node-pool.ts#L160)）。
- [node.ts:896](../../engine/3.8.7engine/cocos/scene-graph/node.ts#L896)：按组件构造器查找池处理组件。

## 简化与运行

本例只支持用组件构造器指定 `poolHandlerComp`，省略组件名字符串查找。`unuse()` 在移出父节点后调用；`reuse(args)` 在 `get` 返回前调用，参数通过 `IArguments` 读取。

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，观察生命周期顺序及 HP、临时效果在回收和取回时的变化。
