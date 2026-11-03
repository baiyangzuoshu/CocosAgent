# 第 6 课：Action 与 Scheduler

**目标：** 看清节点如何提交动作，Director 如何把 ActionManager 接入 Scheduler，再由时间动作更新节点。

## 源码位置

- `engine/cocos2d-x-2/cocos2dx/CCDirector.cpp:148-151`：Director 创建 Scheduler 和 ActionManager，并注册 ActionManager。
- `engine/cocos2d-x-2/cocos2dx/CCDirector.cpp:249-258`：Director 每帧调用 Scheduler 更新。
- `engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp:1005-1009`：`CCNode::runAction()` 把动作交给 ActionManager。
- `engine/cocos2d-x-2/cocos2dx/actions/CCActionManager.cpp:339-361`：ActionManager 遍历动作并调用 `step(dt)`。
- `engine/cocos2d-x-2/cocos2dx/actions/CCActionInterval.cpp:141-159`：时间动作把经过时间转换为 0 到 1 的进度。
- `engine/cocos2d-x-2/cocos2dx/actions/CCActionInterval.cpp:1051-1077`：`CCMoveBy` 记录起点，并按进度更新节点位置。

## 本课代码

Player 运行一个持续 2 秒、向右移动 4 个单位的 `CCMoveBy`。代码按源码目录拆分；只实现一个目标、一个动作和横向位置，不包含引擎的引用计数、暂停、标签、动作组合与并发修改保护。main 中的注册和 Scheduler 调用分别代表 Director 构造与每帧更新。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/actions/CCAction.cpp src/cocos2dx/actions/CCActionInterval.cpp src/cocos2dx/actions/CCActionManager.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/cocos2d-2x-s06
/tmp/cocos2d-2x-s06
~~~

输出位置依次从 `x=1` 到 `x=4`。这是本课精简实现，不依赖完整引擎。
