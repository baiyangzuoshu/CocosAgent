# 第 27 课：取出顺序与重复入池保护

**目标：** 看清节点取出顺序，并阻止同一节点重复占用池位置。

## 本课内容

数组尾部实现 LIFO；重复 `put()` 被身份检查拒绝。

代码入口：[main.ts](src/main.ts)、[CCNodePool.ts](src/extensions/ccpool/CCNodePool.ts)。

## 源码位置

- 引擎 [get()](<../../engine/2.4.15engine/extensions/ccpool/CCNodePool.js#L147>) 从数组尾部取出；重复保护位于本课裁剪版 `put()`。

## 本课必须保留的机制

保留数组尾部 `pop()` 实现 LIFO，以及按节点身份拒绝重复 `put()`，避免池中重复保存同一对象。

## 最小观察宿主

用两个节点、一个池和取回/重复入池操作按钮，通过日志展示取出顺序与接收/拒绝结果。

## 模型化简化与 Creator Runtime 边界

重复入池保护是本课 NodePool 扩展策略；它不是所对照的 Creator 2.4.15 `NodePool.put()` 全部行为。示例不含完整游戏场景、资源和渲染链。

~~~sh
deno task check
deno task build
deno task serve
~~~
