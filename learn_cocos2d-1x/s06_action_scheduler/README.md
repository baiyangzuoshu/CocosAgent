# 第 6 课：Action 与 Scheduler

**目标：** 看清节点如何提交动作，Scheduler 每帧如何驱动 ActionManager，再由时间动作更新节点。

## 源码位置

- `engine/cocos2d-x-1/cocos2dx/CCDirector.cpp:184`：Director 每帧调用 `CCScheduler::tick(dt)`。
- `engine/cocos2d-x-1/cocos2dx/actions/CCActionManager.cpp:95-98`：ActionManager 初始化时把自身注册到 Scheduler。
- `engine/cocos2d-x-1/cocos2dx/base_nodes/CCNode.cpp:990-993`：`CCNode::runAction()` 把动作交给 ActionManager。
- `engine/cocos2d-x-1/cocos2dx/actions/CCActionManager.cpp:350-372`：ActionManager 遍历动作并调用 `step(dt)`。
- `engine/cocos2d-x-1/cocos2dx/actions/CCActionInterval.cpp:100-114`：时间动作把经过时间转换为 0 到 1 的进度。
- `engine/cocos2d-x-1/cocos2dx/actions/CCActionInterval.cpp:885-898`、`engine/cocos2d-x-1/cocos2dx/actions/CCActionInterval.cpp:947-951`：`CCMoveBy` 复用位置更新逻辑并保留位移增量。

## 本课代码

Player 运行一个持续 2 秒、向右移动 4 个单位的 `CCMoveBy`。代码按源码目录拆分；只实现一个目标、一个动作和横向位置，不包含引擎的引用计数、暂停、标签、动作组合与并发修改保护。为便于单独运行，本课用显式 Scheduler 对象代替源码中的单例，由 ActionManager 初始化时注册自身；main 每次调用 `tick()` 代表 Director 的一帧。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/actions/CCAction.cpp src/cocos2dx/actions/CCActionInterval.cpp src/cocos2dx/actions/CCActionManager.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/cocos2d-1x-s06
/tmp/cocos2d-1x-s06
~~~

输出位置依次从 `x=1` 到 `x=4`。这是本课精简实现，不依赖完整引擎。
