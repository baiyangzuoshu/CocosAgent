# 第 17 课：Prefab 创建节点树副本

**问题：** 从一个 Prefab 模板实例化两次，哪些节点数据会变成独立副本？

## 观察步骤

- 查看模板 `Enemy → Body → Marker` 与两棵副本树。
- 修改 `EnemyA` 的根节点和 Body 名称/位置；`EnemyB` 与模板仍保留各自数据。
- 观察两棵副本的父节点都是 `null`：`instantiate` 没有负责场景挂载。

## 本课必须保留的机制

`Prefab.data` 持有模板根节点；`instantiate(prefab)` 转交 `prefab._instantiate()`；Node 的 `_instantiate()` 创建新节点、复制本地名称/位置并递归复制 children。副本身份相互独立。

## 最小观察宿主

一个内存中的 `Enemy → Body → Marker` 模板，调用 `instantiate` 两次，改动 A 副本并将模板/两棵副本树打印到页面。没有 Scene、输入按钮、贴图或渲染器；副本保持 detached。

## Creator 2.4.15 源码对照

- [CCPrefab.js](../../engine/2.4.15engine/cocos2d/core/assets/CCPrefab.js#L167-L199)：Prefab 支持 JIT/非 JIT 实例化路径等 Runtime/编辑器关联逻辑。
- [instantiate.js](../../engine/2.4.15engine/cocos2d/core/platform/instantiate.js#L223-L299)：通用实例化递归克隆普通对象，并保留 `cc.Asset` 引用。
- [base-node.js](../../engine/2.4.15engine/cocos2d/core/utils/base-node.js#L1178-L1192)：Node 克隆后重置父关系并初始化。

## 模型化简化与 Creator Runtime 边界

本课手写 `_instantiate()` 只复制节点名、位置与子节点，不复制组件、监听器或资源引用；省略序列化、依赖资产、编辑器关联和 JIT。模板与副本只是内存对象，没有调用 `Scene.addChild`、NodeActivator 或组件生命周期。不要把这个 Node-only 复制器当成完整 Creator `instantiate`。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~
