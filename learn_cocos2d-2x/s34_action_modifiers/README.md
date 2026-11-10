# 第 34 课：缓动、重复与反向时间

**本课问题：** 间隔动作的归一化进度，如何被动作包装器或 Tween 缓动配置改写？

## 观察结果

四条动作由同一 Scheduler 每帧推进：线性进度、EaseIn 的 t² 进度、重复三轮的短动作，以及反向时间动作。输出显示每个时刻的数值和 Repeat 当前轮次。

## 源码位置

- `engine/cocos2d-x-2/cocos2dx/actions/CCActionEase.h` 声明 Ease 类；[`CCEaseIn::update`](../../engine/cocos2d-x-2/cocos2dx/actions/CCActionEase.cpp#L240) 将进度映射到 easing 函数。
- `engine/cocos2d-x-2/cocos2dx/actions/CCActionInterval.cpp`：[`CCRepeat::update`](../../engine/cocos2d-x-2/cocos2dx/actions/CCActionInterval.cpp#L483) 推进周期；[`CCReverseTime::update`](../../engine/cocos2d-x-2/cocos2dx/actions/CCActionInterval.cpp#L2272) 反转进度。

本课代码：[Ease 包装器](src/cocos2dx/actions/CCActionEase.cpp)、[间隔、重复与反向动作](src/cocos2dx/actions/CCActionInterval.cpp)、[演示入口](src/main.cpp)。

## 简化范围

ProgressAction 只保存当前进度，方便观察包装器。示例省略引擎的引用计数、自动释放、克隆和动作复制，并将 Repeat 限定为间隔动作；引擎还处理即时动作等边界。暂停、停止与 cleanup 属于管理器及节点生命周期，本课聚焦进度包装。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/actions/CCAction.cpp src/cocos2dx/actions/CCActionInterval.cpp src/cocos2dx/actions/CCActionEase.cpp src/cocos2dx/actions/CCActionManager.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/base_nodes/CCNode.cpp -o /tmp/cocos2d-2x-s34
/tmp/cocos2d-2x-s34
~~~
