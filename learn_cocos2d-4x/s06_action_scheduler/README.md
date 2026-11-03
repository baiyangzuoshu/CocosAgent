# 第 6 课：Action 与 Scheduler

**目标：** 看清节点如何提交动作，Director 如何把 ActionManager 接入 Scheduler，再由时间动作更新节点。

## 源码位置

- `engine/cocos2d-x-4/cocos/base/CCDirector.cpp:129`：Director 创建并注册 ActionManager。
- `engine/cocos2d-x-4/cocos/base/CCDirector.cpp:248-265`：Director 每帧更新 Scheduler。
- `engine/cocos2d-x-4/cocos/2d/CCNode.cpp:1420-1424`：`Node::runAction()` 把动作交给 ActionManager。
- `engine/cocos2d-x-4/cocos/2d/CCActionManager.cpp:440-462`：ActionManager 遍历动作并调用 `step(dt)`。
- `engine/cocos2d-x-4/cocos/2d/CCActionInterval.cpp:117-138`：时间动作计算归一化进度并标记完成。
- `engine/cocos2d-x-4/cocos/2d/CCActionInterval.cpp:1190-1214`：`MoveBy` 以进度更新节点位置。

## 本课代码

Player 运行一个持续 2 秒、向右移动 4 个单位的 `MoveBy`。代码保留本代去掉 `CC` 前缀的类名并按源码目录拆分；只实现一个目标、一个动作和横向位置，不包含引用计数、暂停、动作组合与并发修改保护。main 中的注册和 Scheduler 调用分别代表 Director 构造与每帧更新。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCAction.cpp src/cocos/2d/CCActionInterval.cpp src/cocos/2d/CCActionManager.cpp src/cocos/base/CCScheduler.cpp src/cocos/2d/CCNode.cpp -o /tmp/cocos2d-x-s06
/tmp/cocos2d-x-s06
~~~

输出位置依次从 `x=1` 到 `x=4`。这是本课精简实现，不依赖完整引擎。
