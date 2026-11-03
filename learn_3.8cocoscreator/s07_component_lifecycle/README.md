# 第 7 课：组件挂载与生命周期

**目标：** 看清组件怎样挂到 Node 上，以及节点激活时 `onLoad`、`onEnable`、`onDisable` 的调用关系。

## 本课增量

`Node.addComponent()` 创建组件并设置 `component.node`。场景激活时，`NodeActivator` 遍历节点组件：首次调用 `onLoad`，再调用 `onEnable`；节点停用会调用 `onDisable`，再次激活只重复 `onEnable`。

## 源码位置

- `engine/3.8.7engine/cocos/scene-graph/node.ts:1062-1138`：`addComponent` 挂载组件，并在节点已激活时调用 NodeActivator。
- `engine/3.8.7engine/cocos/scene-graph/component.ts:578-642`：`onLoad`、`onEnable`、`onDisable` 生命周期定义。
- `engine/3.8.7engine/cocos/scene-graph/node-activator.ts:195-232`：组件首次激活与启用处理。
- `engine/3.8.7engine/cocos/scene-graph/node-activator.ts:261-285`：激活节点时逐个处理组件并递归子节点。

## 简化

代码沿用前课的 `Node → Scene → Director → NodeActivator`。只实现节点激活引发的三个回调，不包含组件自身 `enabled`、`__preload`、`start/update/lateUpdate`、销毁和编辑器序列化；帧调度留到后续课程。

## 运行

进入本课目录运行 `deno task check`、`deno task build` 和 `deno task serve`，打开 <http://localhost:8000>。页面会显示 `onLoad → onEnable → onDisable → onEnable`。
