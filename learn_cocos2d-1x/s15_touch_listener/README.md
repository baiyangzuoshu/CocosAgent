# 第 15 课：触摸监听与命中判断

**目标：** 理解触摸分发器与监听器各自的职责。

## 本课增量

`CCTouchDispatcher` 把触摸交给 targeted delegate。 监听器自行判断触摸点是否落在示例矩形 `(40, 20)–(60, 40)`，并返回是否命中。模拟两次触摸，分别输出 `Player hit` 和 `Player miss`。

## 源码位置

- `engine/cocos2d-x-1/cocos2dx/touch_dispatcher/CCTouchDispatcher.cpp:350-401`：向 targeted delegate 调用 `ccTouchBegan`，根据返回值记录认领及吞噬状态。
- `engine/cocos2d-x-1/cocos2dx/include/CCTouchDelegateProtocol.h`：触摸代理接口。

## 简化

示例只处理开始事件和单个监听器，命中矩形写在应用回调里，坐标使用上一课的视图坐标；它是演示区域，与 Sprite 的几何边界独立。省略监听器排序、触摸认领的后续移动/结束、吞噬和坐标系转换。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/sprite_nodes/CCSprite.cpp src/cocos2dx/sprite_nodes/CCSpriteFrame.cpp src/cocos2dx/base_nodes/CCNode.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/platform/CCFileUtils.cpp src/cocos2dx/textures/CCTextureCache.cpp src/cocos2dx/CCDirector.cpp -o /tmp/cocos2d-1x-s15
/tmp/cocos2d-1x-s15
~~~
