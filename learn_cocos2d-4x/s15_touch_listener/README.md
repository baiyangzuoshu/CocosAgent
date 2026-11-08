# 第 15 课：触摸监听与命中判断

**目标：** 理解触摸分发器与监听器各自的职责。

## 本课增量

`EventDispatcher` 把触摸交给 `EventListenerTouchOneByOne`。 监听器自行判断触摸点是否落在示例矩形 `(40, 20)–(60, 40)`，并返回是否命中。模拟两次触摸，分别输出 `Player hit` 和 `Player miss`。

## 源码位置

- `engine/cocos2d-x-4/cocos/base/CCEventDispatcher.cpp:953-1008`：分发 Touch 到 `EventListenerTouchOneByOne`，记录认领结果。
- `engine/cocos2d-x-4/cocos/base/CCEventListenerTouch.h`：单点触摸监听器。

## 简化

示例只处理开始事件和单个监听器，命中矩形写在应用回调里，坐标使用上一课的视图坐标；它是演示区域，与 Sprite 的几何边界独立。省略监听器排序、触摸认领的后续移动/结束、吞噬和坐标系转换。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCSprite.cpp src/cocos/2d/CCSpriteFrame.cpp src/cocos/renderer/CCTrianglesCommand.cpp src/cocos/base/CCScheduler.cpp src/cocos/2d/CCComponent.cpp src/cocos/2d/CCComponentContainer.cpp src/cocos/2d/CCNode.cpp src/cocos/platform/CCFileUtils.cpp src/cocos/renderer/CCTextureCache.cpp src/cocos/base/CCDirector.cpp src/cocos/renderer/CCRenderer.cpp -o /tmp/cocos2d-4x-s15
/tmp/cocos2d-4x-s15
~~~
