# 第 7 课：Node 更新与 Scheduler

**目标：** 看清 1.x 如何把 Node 注册为 Scheduler 的更新目标，并在一帧中调用虚函数 `update(dt)`。

## 本课增量

1.x 本地源码没有 Component/ComponentContainer。本课沿历史版本实际存在的 Node 更新接口：`scheduleUpdate()` 将节点加入 Scheduler，`tick(dt)` 遍历目标并调用 `update(dt)`。

## 源码位置

- `engine/cocos2d-x-1/cocos2dx/base_nodes/CCNode.cpp:1026-1034`：`scheduleUpdate` 转发到 `scheduleUpdateWithPriority`，后者向共享 Scheduler 注册 Node。
- `engine/cocos2d-x-1/cocos2dx/CCScheduler.cpp:642-660`：Scheduler 的 `tick(dt)` 调用已注册目标的 `update(dt)`。

## 简化

每课独立实现一个 Node 子类和单例 Scheduler，仅保留注册、去重和帧回调；省略优先级、暂停状态、移除、动作调度和内存管理。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/base_nodes/CCNode.cpp src/cocos2dx/CCScheduler.cpp -o /tmp/cocos2d-1x-s07
/tmp/cocos2d-1x-s07
~~~

输出一条 `Player::update`，`dt` 约为 `0.0167` 秒。
