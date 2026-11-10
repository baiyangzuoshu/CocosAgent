# 第 34 课：缓动、重复与反向时间

**本课问题：** 间隔动作的归一化进度，如何被动作包装器或 Tween 缓动配置改写？

## 观察结果

四条动作由同一 Scheduler 每帧推进：线性进度、EaseIn 的 t² 进度、重复三轮的短动作，以及反向时间动作。输出显示每个时刻的数值和 Repeat 当前轮次。

## 源码位置

- `engine/cocos2d-x-4/cocos/2d/CCActionEase.h/.cpp`：[`EaseIn` 模板实现](../../engine/cocos2d-x-4/cocos/2d/CCActionEase.cpp#L220) 调用 `tweenfunc::easeIn`。
- `engine/cocos2d-x-4/cocos/2d/CCActionInterval.cpp`：[`Repeat::update`](../../engine/cocos2d-x-4/cocos/2d/CCActionInterval.cpp#L483) 推进周期；[`ReverseTime::update`](../../engine/cocos2d-x-4/cocos/2d/CCActionInterval.cpp#L2478) 反转进度。

本课代码：[Ease 包装器](src/cocos/2d/CCActionEase.cpp)、[间隔、重复与反向动作](src/cocos/2d/CCActionInterval.cpp)、[演示入口](src/main.cpp)。

## 简化范围

ProgressAction 只保存当前进度，方便观察包装器。示例省略引擎的引用计数、自动释放、克隆和动作复制，并将 Repeat 限定为间隔动作；引擎还处理即时动作等边界。暂停、停止与 cleanup 属于管理器及节点生命周期，本课聚焦进度包装。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCAction.cpp src/cocos/2d/CCActionInterval.cpp src/cocos/2d/CCActionEase.cpp src/cocos/2d/CCActionManager.cpp src/cocos/base/CCScheduler.cpp src/cocos/2d/CCNode.cpp -o /tmp/cocos2d-4x-s34
/tmp/cocos2d-4x-s34
~~~
