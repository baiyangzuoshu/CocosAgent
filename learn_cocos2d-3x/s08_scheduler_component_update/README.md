# 第 8 课：Scheduler 驱动组件更新

**目标：** 看清 Cocos2d-x 3.x 如何把 `Scheduler`、`Node::update` 和 `ComponentContainer::visit` 接成帧更新链。

## 本课增量

`Node::addComponent()` 内部先调用 `scheduleUpdate()`，再挂载组件。Scheduler 每帧调用 Node 的 `update(dt)`，Node 把 `dt` 转交给组件容器；组件随后收到 `update(dt)`。

## 源码位置

- `engine/cocos2d-x-3/cocos/2d/CCNode.cpp:1538-1546` (`scheduleUpdate`)、`:1659-1675` (`update`)、`:1962-1971` (`addComponent`)。
- `engine/cocos2d-x-3/cocos/base/CCScheduler.cpp:823-864`: Scheduler 遍历更新目标并调用回调。
- `engine/cocos2d-x-3/cocos/2d/CCComponentContainer.cpp:121-148`: Container 转发组件 update 与场景进出回调。

## 简化

复用第 7 课的组件容器，只增加 Scheduler 的 Node 更新列表；省略优先级、暂停/恢复、目标移除、Director 单例和 `Ref`。`scheduler.update()` 代表 Director 的一帧调度。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/base/CCScheduler.cpp src/cocos/2d/CCComponent.cpp src/cocos/2d/CCComponentContainer.cpp src/cocos/2d/CCNode.cpp -o /tmp/cocos2d-x-s08
/tmp/cocos2d-x-s08
~~~

本代由 `addComponent` 自动注册 Node 更新；输出保留 `onAdd → onEnter → component update → onExit → onRemove`。
