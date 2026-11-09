# 第 31 课：回收与清理的区别

**目标：** 确认 Creator 3.8 的节点移除只改变层级，不带 `cleanup` 开关。

## 本课增量

点击“观察移除后事件监听”。示例把带触摸监听的节点放入 `NodePool`，再取出并挂回场景；监听仍会触发。Creator 3.8 的 `removeFromParent()` 不接收 `cleanup` 参数，节点移出与销毁是分开的操作。

代码入口：[main.ts](src/main.ts)、[node-pool.ts](src/extensions/ccpool/node-pool.ts)、[node.ts](src/cocos/scene-graph/node.ts)。

## 源码位置

- [node-pool.ts:126](../../engine/3.8.7engine/extensions/ccpool/node-pool.ts#L126)：入池时只调用 `removeFromParent()`。
- [node.ts:794](../../engine/3.8.7engine/cocos/scene-graph/node.ts#L794)：移除节点没有 `cleanup` 参数。
- [node.ts:805](../../engine/3.8.7engine/cocos/scene-graph/node.ts#L805)：父节点只清除父子关系。

## 简化与运行

只观察节点事件监听在分离、重新挂载后的保留；省略 `destroy()` 的资源释放流程。

~~~sh
deno task check
deno task build
deno task serve
~~~

重新挂载后事件监听仍触发，`activeInHierarchy=true`。
