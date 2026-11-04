# 第 8 课：Node 定时回调

**目标：** 看清 1.x 如何把 `Node::schedule(selector, interval)` 转成 Scheduler 管理的 Timer。

## 本课增量

Node 将成员函数和时间间隔交给 Scheduler。每帧 `tick(dt)` 推进 Timer；达到间隔后 Timer 调用目标函数并清零累计时间。本例使用 0.5 秒间隔，每次 tick 为 0.25 秒。

## 源码位置

- `engine/cocos2d-x-1/cocos2dx/base_nodes/CCNode.cpp:1041-1051`：`schedule` 把 selector 和 interval 交给共享 Scheduler。
- `engine/cocos2d-x-1/cocos2dx/CCScheduler.cpp:122-159`：Timer 保存目标/selector，累计时间后触发回调。
- `engine/cocos2d-x-1/cocos2dx/CCScheduler.cpp:642-732`：Scheduler 每帧推进目标更新与 Timer。

## 简化

只实现一个目标的重复 interval 回调；省略暂停、取消、repeat/delay 参数、目标引用计数和调度期间修改保护。首个 tick 只初始化 elapsed，与本地 Timer 的初始状态一致。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/base_nodes/CCNode.cpp src/cocos2dx/CCScheduler.cpp -o /tmp/cocos2d-1x-s08
/tmp/cocos2d-1x-s08
~~~

运行两次 `timer callback`，间隔由四个 `0.25s` 帧推进。
