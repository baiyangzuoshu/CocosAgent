# 第 7 课：组件挂载与生命周期

**目标：** 看清 Cocos2d-x 4.0 如何用 `ComponentContainer` 管理组件挂载、场景回调和帧更新。

## 本课增量

`Node::addComponent()` 启用 Node 更新并把组件交给 Container。Container 设置 owner 后调用 `onAdd`；Node 进入/离开场景时分别通知 `onEnter/onExit`；每帧 `Node::update(dt)` 转给组件的 `update(dt)`；移除时调用 `onRemove`。

## 源码位置

- `engine/cocos2d-x-4/cocos/2d/CCComponentContainer.cpp:55-76`、`:79-97`、`:121-148`：添加/移除、更新和场景进出回调。
- `engine/cocos2d-x-4/cocos/2d/CCComponent.cpp:72-119`：组件回调定义。
- `engine/cocos2d-x-4/cocos/2d/CCNode.cpp`：`CCNode.cpp:1271-1300` (`onEnter`)、`1359-1386` (`onExit`)、`1608-1624` (`update`)、`1921-1930` (`addComponent`)。

## 简化

容器只保留组件指针列表和 owner，不实现 `Ref` 引用计数、名称索引、重复类型检查、Lua/JavaScript 绑定与 Scheduler。示例显式调用 `Node::update` 表示调度器送来的帧回调。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCComponent.cpp src/cocos/2d/CCComponentContainer.cpp src/cocos/2d/CCNode.cpp -o /tmp/cocos2d-x-s07
/tmp/cocos2d-x-s07
~~~

输出顺序为 `onAdd → onEnter → update → onExit → onRemove`。
