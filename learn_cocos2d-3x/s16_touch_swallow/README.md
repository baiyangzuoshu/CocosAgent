# 第 16 课：触摸认领与吞噬

**目标：** 看清触摸监听器的顺序，以及认领和吞噬的关系。

## 本课增量

`EventDispatcher` 按固定优先级调用 `EventListenerTouchOneByOne`。 示例故意先注册低优先级监听器，再注册高优先级监听器，观察排序；高优先级回调返回是否命中。

- 认领且开启吞噬：后续监听器不收到触摸。
- 认领但未开启吞噬：后续监听器仍收到触摸。
- 未认领：即使开启吞噬，后续监听器仍收到触摸。

## 源码位置

- `engine/cocos2d-x-3/cocos/base/CCEventDispatcher.cpp:742-801,953-1067`：按优先级分发，认领且吞噬时停止后续监听器。
- `engine/cocos2d-x-3/cocos/base/CCEventListenerTouch.h:55-70`：单点触摸监听器的吞噬设置。

## 简化

只演示一个触摸开始事件与固定优先级；省略场景树优先级、多点集合、认领后的移动和结束、监听器动态增删。示例保留上一课的视图坐标和回调内矩形判断。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCSprite.cpp src/cocos/2d/CCSpriteFrame.cpp src/cocos/renderer/CCTrianglesCommand.cpp src/cocos/base/CCScheduler.cpp src/cocos/2d/CCComponent.cpp src/cocos/2d/CCComponentContainer.cpp src/cocos/2d/CCNode.cpp src/cocos/platform/CCFileUtils.cpp src/cocos/renderer/CCTextureCache.cpp src/cocos/base/CCDirector.cpp src/cocos/renderer/CCRenderer.cpp -o /tmp/cocos2d-3x-s16
/tmp/cocos2d-3x-s16
~~~

三组 `scenario` 输出显示高优先级监听器先执行，以及低优先级监听器是否执行。
