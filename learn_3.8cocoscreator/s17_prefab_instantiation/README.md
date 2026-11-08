# 第 17 课：Prefab 实例化

**目标：** 从 Prefab 数据节点生成两棵独立节点树。

## 本课增量

`Prefab.data` 保存模板根节点；`instantiate` 调用 `_instantiate`，递归复制节点名、位置和子节点。两个实例分别改名、移动，再加入场景。

## 源码位置

- `engine/3.8.7engine/cocos/scene-graph/prefab/prefab.ts:75-90,168-197`：Prefab 数据和 `_instantiate`。
- `engine/3.8.7engine/cocos/serialization/instantiate.ts:80-130`：公开入口接受 Prefab 或可实例化对象。
- `engine/3.8.7engine/cocos/scene-graph/node.ts`：Node 的场景树数据与内部实例化协议。

## 简化

只复制节点名、位置和子节点，不复制组件、事件监听器和资源引用；省略序列化图遍历、编辑器关联及原型优化。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，页面状态会显示实例及子节点彼此独立、Prefab 创建次数为 2。
