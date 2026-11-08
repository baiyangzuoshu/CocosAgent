# 第 16 课：触摸认领与吞噬

**目标：** 看清触摸监听器的顺序，以及认领和吞噬的关系。

## 本课增量

`CCTouchDispatcher` 按优先级调用 targeted delegate。 示例故意先注册低优先级监听器，再注册高优先级监听器，观察排序；高优先级回调返回是否命中。

- 认领且开启吞噬：后续监听器不收到触摸。
- 认领但未开启吞噬：后续监听器仍收到触摸。
- 未认领：即使开启吞噬，后续监听器仍收到触摸。

## 源码位置

- `engine/cocos2d-x-2/cocos2dx/touch_dispatcher/CCTouchDispatcher.cpp:153-157,341-391`：注册 targeted delegate、认领与吞噬触摸。
- `engine/cocos2d-x-2/cocos2dx/touch_dispatcher/CCTouchDispatcher.h`：触摸分发入口。

## 简化

只演示一个触摸开始事件与固定优先级；省略场景树优先级、多点集合、认领后的移动和结束、监听器动态增删。示例保留上一课的视图坐标和回调内矩形判断。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/sprite_nodes/CCSprite.cpp src/cocos2dx/sprite_nodes/CCSpriteFrame.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/base_nodes/CCNode.cpp src/cocos2dx/support/component/CCComponent.cpp src/cocos2dx/support/component/CCComponentContainer.cpp src/cocos2dx/platform/CCFileUtils.cpp src/cocos2dx/textures/CCTextureCache.cpp src/cocos2dx/CCDirector.cpp -o /tmp/cocos2d-2x-s16
/tmp/cocos2d-2x-s16
~~~

三组 `scenario` 输出显示高优先级监听器先执行，以及低优先级监听器是否执行。
