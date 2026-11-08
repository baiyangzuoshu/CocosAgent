# 第 14 课：触摸输入入口

**目标：** 看清平台坐标如何变为引擎触摸数据。

## 本课增量

`GLView::handleTouchesBegin` 换算视口坐标并创建 EventTouch，交给 EventDispatcher。 示例模拟输入 `(110, 80)`、视口偏移 `(10, 20)`、缩放 `2`，输出视图坐标 `(50, 30)`。

## 源码位置

- `engine/cocos2d-x-4/cocos/platform/CCGLView.cpp:293-339`：创建 Touch 和 EventTouch，交给 EventDispatcher。（以对应文件的 `handleTouchesBegin` 为准。）
- `engine/cocos2d-x-4/cocos/base/CCEventTouch.h`：触摸事件类型。
- `engine/cocos2d-x-4/cocos/base/CCEventDispatcher.cpp`：事件分发入口。

## 简化

示例使用一次模拟按下和函数回调，固定使用第 0 号触摸槽，不创建系统窗口；省略多点管理、触摸生命周期、节点命中和事件传播。输出是视图坐标，尚未做引擎世界坐标转换。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCSprite.cpp src/cocos/2d/CCSpriteFrame.cpp src/cocos/renderer/CCTrianglesCommand.cpp src/cocos/base/CCScheduler.cpp src/cocos/2d/CCComponent.cpp src/cocos/2d/CCComponentContainer.cpp src/cocos/2d/CCNode.cpp src/cocos/platform/CCFileUtils.cpp src/cocos/renderer/CCTextureCache.cpp src/cocos/base/CCDirector.cpp src/cocos/renderer/CCRenderer.cpp -o /tmp/cocos2d-4x-s14
/tmp/cocos2d-4x-s14
~~~

输出末尾包含 `touch began` 和视图坐标 `(50, 30)`。
