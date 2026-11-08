# 第 17 课：Prefab 实例化

**目标：** 从一个 Prefab 数据节点创建两棵互相独立的节点树。

## 本课增量

`Prefab.data` 保存模板根节点；`instantiate` 调用模板的 `_instantiate`，递归复制节点名、位置和子节点。创建两个实例后分别改名、移动，并挂到场景。

## 源码位置

- `engine/2.4.15engine/cocos2d/core/assets/CCPrefab.js:75-90,167-195`：Prefab 持有根节点数据并负责实例化。
- `engine/2.4.15engine/cocos2d/core/platform/instantiate.js:56-101`：统一实例化入口，转交对象的 `_instantiate`。
- `engine/2.4.15engine/cocos2d/core/utils/base-node.js:1178-1192`：Node 复制后重置父节点并初始化。

## 简化

只复制节点名、位置和子节点，不复制组件、事件监听器和资源引用；省略 Prefab 序列化、编辑器关联及 JIT 优化。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 <http://localhost:8000>，页面状态会显示实例与子节点彼此独立、Prefab 创建次数为 2。
