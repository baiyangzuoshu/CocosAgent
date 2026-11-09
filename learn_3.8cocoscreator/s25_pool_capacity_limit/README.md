# 第 25 课：对象池容量上限与超额销毁

**目标：** 把池容量限制为 1；池满时，额外节点不入池并销毁。

## 本课增量

点击“回收 EnemyB（容量上限 1）”。示例先把 EnemyA 放入池，再尝试回收 EnemyB。应用层的 putWithinCapacity 在调用 NodePool.put 前读取 size；池满就移除并请求销毁。被丢弃的 EnemyB 不进入对象池，也不会调用池处理器的 unuse。

Creator 3.8 的 NodePool 提供 size、put 和 clear，但没有容量上限；容量限制属于调用方策略。

代码入口：[main.ts](src/main.ts)、[node-pool.ts](src/extensions/ccpool/node-pool.ts)、[node.ts](src/cocos/scene-graph/node.ts)。

## 源码位置

- [node-pool.ts:98](../../engine/3.8.7engine/extensions/ccpool/node-pool.ts#L98)：size 返回池内对象数；[put:126](../../engine/3.8.7engine/extensions/ccpool/node-pool.ts#L126) 移除父节点、调用 unuse 并加入池，没有容量判断。
- [node.ts:1367](../../engine/3.8.7engine/cocos/scene-graph/node.ts#L1367)：Node.destroy 标记节点失效并进入对象销毁流程。

## 简化与运行

~~~sh
deno task check
deno task build
deno task serve
~~~

页面加载完成后点击容量按钮，观察 size 保持为 1、EnemyB 不入池并进入销毁流程。再点清空对象池观察池内节点销毁。
