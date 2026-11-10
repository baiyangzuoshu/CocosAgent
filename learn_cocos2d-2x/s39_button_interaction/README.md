# 第 39 课：CocoStudio Button 与 Widget 触摸事件

**本课问题：** CocoStudio Button 怎样用 Widget 命中结果更新外观并通知业务层？

## 观察结果

Button 复用 Widget 的命中与触摸流程。触摸开始聚焦并显示按下态；移出后失焦；结束时只有仍聚焦才发 `TOUCH_EVENT_ENDED`，否则发 `TOUCH_EVENT_CANCELED`。本例用 ENDED 计作一次激活。

## 源码位置

- [UIButton::init](../../engine/cocos2d-x-2/extensions/CocoStudio/GUI/UIWidgets/UIButton.cpp#L87)：启用触摸输入。
- [Widget::onTouchBegan/Moved/Ended](../../engine/cocos2d-x-2/extensions/CocoStudio/GUI/BaseClasses/UIWidget.cpp#L698)：命中后设置焦点，移动更新焦点，结束按焦点发 ended/canceled。
- [Widget::addTouchEventListener 与 releaseUpEvent](../../engine/cocos2d-x-2/extensions/CocoStudio/GUI/BaseClasses/UIWidget.cpp#L777)：把触摸阶段交给应用回调。
- [Button 按下外观](../../engine/cocos2d-x-2/extensions/CocoStudio/GUI/UIWidgets/UIButton.cpp#L406)：Widget 状态变化后切换对应 renderer。

本课代码：[Widget](src/extensions/CocoStudio/GUI/BaseClasses/UIWidget.h)、[Widget 输入流程](src/extensions/CocoStudio/GUI/BaseClasses/UIWidget.cpp)、[Button](src/extensions/CocoStudio/GUI/UIWidgets/UIButton.h)、[入口](src/main.cpp)。

## 简化范围

只保留矩形命中、焦点/按下态、ended/canceled 回调和 Button 外观状态。省略 CocoStudio 事件分发器、父节点拦截、纹理 renderer、裁剪和引用计数。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/extensions/CocoStudio/GUI/BaseClasses/UIWidget.cpp src/extensions/CocoStudio/GUI/UIWidgets/UIButton.cpp -o /tmp/cocos2d-2x-s39
/tmp/cocos2d-2x-s39
~~~
