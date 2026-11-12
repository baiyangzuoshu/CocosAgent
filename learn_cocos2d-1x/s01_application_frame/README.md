# 第 1 课：应用入口与帧循环

**目标：** 平台循环触发 Director；Director 更新时间并绘制当前场景。

## 源码位置

- `engine/cocos2d-x-1/cocos2dx/CCDirector.cpp:71`：`CCDirector::sharedDirector()` 返回平台 Director 单例。
- `engine/cocos2d-x-1/cocos2dx/layers_scenes_transitions_nodes/CCScene.cpp:57`：`CCScene::node()` 初始化并 autorelease 新场景。
- `engine/cocos2d-x-1/cocos2dx/CCDirector.cpp:176`：CCDirector::drawScene()：驱动每帧更新与场景访问。
- `engine/cocos2d-x-1/cocos2dx/CCDirector.cpp:501`：CCDirector::runWithScene()：设置首个场景。
- `engine/cocos2d-x-1/cocos2dx/CCScheduler.cpp:642`：CCScheduler::tick(dt)：推进调度任务。
- `engine/cocos2d-x-1/cocos2dx/platform/ios/EAGLView.mm:288`：iOS 帧回调：调用 drawScene()。

## 本课代码

代码放在 `src/`，目录按 `engine/cocos2d-x-1/` 镜像。`main.cpp` 通过 `CCDirector::sharedDirector()` 取得 Director，用 1.x 的 `CCScene::node()` 创建首个场景，再调用 `runWithScene()`；固定三帧模拟平台循环进入 `drawScene()`。本课删去了 `CCObject`/autorelease pool，因此精简版 Director 用 `std::unique_ptr` 持有运行中的场景，代替完整引擎里场景栈对 autorelease 场景的引用持有。`Scene` 只保留 `visit()` 以标记场景绘制阶段。

## 观察结果

平台循环打印三帧；每帧先更新 Scheduler，再访问当前 Scene。

## 编译运行

在本课目录执行：

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/CCDirector.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/layers_scenes_transitions_nodes/CCScene.cpp -o /tmp/cocos2d-1x-s01
/tmp/cocos2d-1x-s01
~~~

这是本课自己的精简实现；没有编译或调用完整引擎。
