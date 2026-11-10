# 第 39 课：ui::Button 命中、状态与回调

**本课问题：** Button 如何把 Widget 的触摸命中转成按下外观和点击回调？

## 观察结果

`ui::Button` 继承 `Widget`。触摸开始先命中并进入高亮/按下态；移动时重新命中；结束时若仍高亮则发 ENDED 并调用 click listener，否则发 CANCELED。例子先移出再松开，再完成一次正常点按。

## 源码位置

- [Button 构造函数启用触摸](../../engine/cocos2d-x-4/cocos/ui/UIButton.cpp#L77)：Button 打开 Widget 输入。
- [Widget 触摸命中与结束分支](../../engine/cocos2d-x-4/cocos/ui/UIWidget.cpp#L761)：命中、更新高亮，并在结束时区分 release/cancel。
- [Widget 回调派发](../../engine/cocos2d-x-4/cocos/ui/UIWidget.cpp#L897)：ended 触摸事件后调用 click listener。
- [Button 按下状态 renderer](../../engine/cocos2d-x-4/cocos/ui/UIButton.cpp#L511)：用 pressed 状态更新按钮 renderer。

本课代码：[Widget](src/cocos/ui/UIWidget.h)、[Widget 输入流程](src/cocos/ui/UIWidget.cpp)、[Button](src/cocos/ui/UIButton.h)、[入口](src/main.cpp)。

## 简化范围

只保留矩形命中、按下/正常状态、ended/canceled 分支和 click listener。省略相机与裁剪、父节点拦截、真实纹理 renderer、事件分发器和引用计数。

## 运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/ui/UIWidget.cpp src/cocos/ui/UIButton.cpp -o /tmp/cocos2d-4x-s39
/tmp/cocos2d-4x-s39
~~~
