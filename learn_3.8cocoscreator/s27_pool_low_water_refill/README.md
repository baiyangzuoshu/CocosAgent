# 第 27 课：对象池低水位补充

**目标：** 池内节点降到 1 个时，按批补充，并将池大小限制为 4。

## 本课增量

预热池启动时有 2 个节点。每次取出后，应用层检查 size；降到低水位 1 时最多补入 3 个 Prefab 实例，但不会超过 4。NodePool 本身不管理低水位或容量，这些规则由启动和取用代码负责。

代码入口：[main.ts](src/main.ts)、[node-pool.ts](src/extensions/ccpool/node-pool.ts)、[instantiate.ts](src/cocos/serialization/instantiate.ts)。

## 源码位置

- [node-pool.ts:98](../../engine/3.8.7engine/extensions/ccpool/node-pool.ts#L98)：size 返回池内对象数；[put:126](../../engine/3.8.7engine/extensions/ccpool/node-pool.ts#L126) 和 [get:151](../../engine/3.8.7engine/extensions/ccpool/node-pool.ts#L151) 只负责存取节点。
- [instantiate.ts:105](../../engine/3.8.7engine/cocos/serialization/instantiate.ts#L105)：补货时复制 Prefab 节点。

## 简化与运行

~~~sh
deno task check
deno task build
deno task serve
~~~

资源加载后点击“取出一个”。第一次取出后池内数量降到 1，补货 3 个并回到容量 4；继续点击观察池大小变化。
