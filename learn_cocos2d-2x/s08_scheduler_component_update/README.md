# 第 8 课：Scheduler 驱动组件更新

**目标：** 把 2.x 的 `CCScheduler`、`CCNode::update` 和 `CCComponentContainer::visit` 接成一条帧更新链。

## 本课增量

组件挂载时仍只触发 `onEnter`。调用方显式执行 `CCNode::scheduleUpdate()` 后，Scheduler 每帧调用 Node 的 `update(dt)`，Node 再把 `dt` 转给组件容器。此代的 `addComponent()` 本身不会注册 Node 更新。

## 源码位置

- `engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp:1056-1064`：Node 把自身注册到 Scheduler。
- `engine/cocos2d-x-2/cocos2dx/CCScheduler.cpp:783-820`：Scheduler 更新已注册目标。
- `engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp:1133-1143`：Node 更新时调用组件容器 `visit`。
- `engine/cocos2d-x-2/cocos2dx/support/component/CCComponentContainer.cpp:154-164`：Container 遍历并更新组件。

## 简化

本课复用第 7 课的 `CCComponentContainer`，增加最小 Scheduler 目标列表。省略优先级、暂停/恢复、移除目标、Director 单例和引用计数；`scheduler.update()` 代表 Director 的一帧调度。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/support/component/CCComponent.cpp src/cocos2dx/support/component/CCComponentContainer.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/cocos2d-2x-s08
/tmp/cocos2d-2x-s08
~~~

输出 `onEnter` 后，每次 Scheduler 更新会产生一条 `component update`。
