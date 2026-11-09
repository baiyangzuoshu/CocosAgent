# 第 26 课：对象池预热与首次复用

**目标：** 在首次取用前创建两个节点，第一次 get 直接复用已有实例。

## 本课增量

资源加载后，示例先 instantiate 两个 Prefab 并放入独立的预热池。点击“从预热池取出一个”，NodePool.get 调用 reuse 并返回已有节点；取出前后的 Prefab 实例化计数不变。

预热代码属于应用层启动流程。Creator 3.8 的 NodePool 只提供 put/get 等基础操作，不会自动预创建对象。

代码入口：[main.ts](src/main.ts)、[node-pool.ts](src/extensions/ccpool/node-pool.ts)、[instantiate.ts](src/cocos/serialization/instantiate.ts)。

## 源码位置

- [node-pool.ts:126](../../engine/3.8.7engine/extensions/ccpool/node-pool.ts#L126)：put 移除父节点、调用 unuse 并保存对象；[get:151](../../engine/3.8.7engine/extensions/ccpool/node-pool.ts#L151) 取出对象并调用 reuse。
- [instantiate.ts:105](../../engine/3.8.7engine/cocos/serialization/instantiate.ts#L105)：Prefab/节点实例化入口；节点复制调用 _instantiate。

## 简化与运行

~~~sh
deno task check
deno task build
deno task serve
~~~

页面加载并完成资源初始化后，状态区显示预热数量为 2。点击取出按钮，观察池大小减少且实例化计数保持不变。
