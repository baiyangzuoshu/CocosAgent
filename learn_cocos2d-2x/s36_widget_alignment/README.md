# 第 36 课：CocoStudio Widget 百分比定位

**本课问题：** Cocos2d-x 2.x 的 Widget 如何把百分比位置换算为父节点坐标？

## 观察结果

CocoStudio `ui::Widget` 使用 `POSITION_PERCENT`，示例将中心锚点放在父节点 `(0.9, 0.5)`。父节点从 960×640 变为 1280×720，位置从 `(864, 320)` 变为 `(1152, 360)`。右侧空隙从 16 增至 48，说明百分比位置保持比例，不等价于 Creator 的固定边距对齐。

## 源码位置

- [`Widget::setPositionPercent`](../../engine/cocos2d-x-2/extensions/CocoStudio/GUI/BaseClasses/UIWidget.cpp#L882) 保存百分比，并在运行状态下换算成父节点坐标。
- [`Widget::updateSizeAndPosition`](../../engine/cocos2d-x-2/extensions/CocoStudio/GUI/BaseClasses/UIWidget.cpp#L453) 按父节点尺寸刷新绝对位置和尺寸；`onSizeChanged` 会通知子 Widget 更新（[`onSizeChanged`](../../engine/cocos2d-x-2/extensions/CocoStudio/GUI/BaseClasses/UIWidget.cpp#L583)）。这是 CocoStudio 扩展中的 Widget。

本课代码：[CCNode 基类片段](src/cocos2dx/base_nodes/CCNode.h)、[CocoStudio UIWidget](src/extensions/CocoStudio/GUI/BaseClasses/UIWidget.h)、[位置换算](src/extensions/CocoStudio/GUI/BaseClasses/UIWidget.cpp)、[演示入口](src/main.cpp)。

## 简化范围

只实现 `POSITION_PERCENT` 和父尺寸变化后的 `updateSizeAndPosition`，假设 Widget 锚点居中。省略百分比尺寸、LayoutParameter、触摸与渲染、运行状态和完整父子回调。

## 运行

在本目录执行：

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/extensions/CocoStudio/GUI/BaseClasses/UIWidget.cpp -o /tmp/cocos2d-2x-s36
/tmp/cocos2d-2x-s36
~~~
