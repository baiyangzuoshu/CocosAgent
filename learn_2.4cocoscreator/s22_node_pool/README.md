# 第 22 课：NodePool 节点复用

**目标：** 理解 `NodePool` 怎样暂存场景节点，并在需要时取回同一个实例。

## 本课内容

`put()` 用 `removeFromParent(false)` 将节点移出活动场景并存入池；`get()` 从池中取回节点；`clear()` 对池内节点请求销毁。回收和重新挂载会触发组件启停，但不会重复触发 `onLoad/start`。

代码入口：[main.ts](src/main.ts)、[CCNodePool.ts](src/extensions/ccpool/CCNodePool.ts)、[base-node.ts](src/cocos2d/core/utils/base-node.ts)、[CCObject.ts](src/cocos2d/core/platform/CCObject.ts)。

## 源码位置

Creator 2.4.15 的 [clear/put/get](../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L100)。

## 本课必须保留的机制

保留同一节点的取出与回收、`removeFromParent(false)` 不清理节点状态，以及 `clear()` 触发销毁而非复用。

## 最小观察宿主

页面提供一个节点、回收/取回和清池按钮；状态区显示池大小、节点有效状态和组件生命周期记录。

## 模型化简化与 Creator Runtime 边界

本目录只模拟基础 `put/get/clear` 和生命周期结果；省略 `poolHandlerComp` 回调、容量策略、完整 Creator Runtime 与渲染。

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，等待 EnemyA 的 `start` 后回收和取回，再比较 `onDisable/onEnable` 与首次生命周期回调。
