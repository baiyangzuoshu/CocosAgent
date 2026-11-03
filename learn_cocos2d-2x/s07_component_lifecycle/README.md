# 第 7 课：组件挂载与更新

**目标：** 看清 2.x 的 `CCNode` 如何把组件委托给 `CCComponentContainer`。

## 本课增量

挂载时 Container 设置 owner 并立即调用 `onEnter`；`CCNode::update(dt)` 把帧更新转给 Container 的 `visit(dt)`；移除组件时调用 `onExit` 并清空 owner。这个快照没有 `onAdd/onRemove` 回调，`onEnter` 是挂载时触发的。

## 源码位置

- `engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp:1133-1143`、`1307-1310`：Node 更新委托 Container，挂载 API 转发到 Container。
- `engine/cocos2d-x-2/cocos2dx/support/component/CCComponentContainer.cpp:56-77`：设置 owner、保存组件并调用 `onEnter`。
- `engine/cocos2d-x-2/cocos2dx/support/component/CCComponentContainer.cpp:79-145`：移除时 `onExit`，以及 `visit` 更新组件。

## 简化

容器使用 `vector` 保留一个最小挂载路径；省略 `CCObject` 引用计数、名称查找、脚本绑定和 Scheduler。示例显式调用 `Node::update` 表示调度器回调。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/support/component/CCComponent.cpp src/cocos2dx/support/component/CCComponentContainer.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/cocos2d-2x-s07
/tmp/cocos2d-2x-s07
~~~

输出顺序为 `onEnter (attached) → update → onExit (removed)`。
