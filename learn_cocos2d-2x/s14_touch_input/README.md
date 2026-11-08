# 第 14 课：触摸输入入口

**目标：** 看清平台坐标如何变为引擎触摸数据。

## 本课增量

`CCEGLViewProtocol::handleTouchesBegin` 将平台坐标按视口偏移和缩放换算，创建触摸并通知代理。 示例模拟输入 `(110, 80)`、视口偏移 `(10, 20)`、缩放 `2`，输出视图坐标 `(50, 30)`。

## 源码位置

- `engine/cocos2d-x-2/cocos2dx/platform/CCEGLViewProtocol.cpp:197-239`：创建触摸、按视口和缩放转换坐标，再通知代理。
- `engine/cocos2d-x-2/cocos2dx/touch_dispatcher/CCTouchDispatcher.cpp:487-491`：触摸开始入口。

## 简化

示例使用一次模拟按下和函数回调，固定使用第 0 号触摸槽，不创建系统窗口；省略多点管理、触摸生命周期、节点命中和事件传播。输出是视图坐标，尚未做引擎世界坐标转换。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/sprite_nodes/CCSprite.cpp src/cocos2dx/sprite_nodes/CCSpriteFrame.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/base_nodes/CCNode.cpp src/cocos2dx/support/component/CCComponent.cpp src/cocos2dx/support/component/CCComponentContainer.cpp src/cocos2dx/platform/CCFileUtils.cpp src/cocos2dx/textures/CCTextureCache.cpp src/cocos2dx/CCDirector.cpp -o /tmp/cocos2d-2x-s14
/tmp/cocos2d-2x-s14
~~~

输出末尾包含 `touch began` 和视图坐标 `(50, 30)`。
