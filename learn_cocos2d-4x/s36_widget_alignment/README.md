# 第 36 课：ui::Widget 百分比定位

**本课问题：** Cocos2d-x 4.x 的 `ui::Widget` 如何按父节点尺寸重算百分比位置？

## 观察结果

示例设置 `PositionType::PERCENT` 和位置 `(0.9, 0.5)`。父节点从 960×640 变为 1280×720，Widget 中心从 `(864, 320)` 变为 `(1152, 360)`；右侧空隙从 16 增至 48。它保持位置比例，不是 Creator 式固定边距约束。

## 源码位置

- [`Widget::setPositionPercent`](../../engine/cocos2d-x-4/cocos/ui/UIWidget.cpp#L1013) 保存百分比位置；[`updateSizeAndPosition`](../../engine/cocos2d-x-4/cocos/ui/UIWidget.cpp#L379) 按父尺寸换算坐标。
- [`Widget::onSizeChanged`](../../engine/cocos2d-x-4/cocos/ui/UIWidget.cpp#L528) 会让子 Widget 更新；使用 `LayoutComponent` 时，百分比位置走该组件分支（[`setPositionType`](../../engine/cocos2d-x-4/cocos/ui/UIWidget.cpp#L1051)）。

本课代码：[UIWidget 头文件](src/cocos/ui/UIWidget.h)、[UIWidget 实现](src/cocos/ui/UIWidget.cpp)、[演示入口](src/main.cpp)。

## 简化范围

只实现未使用 LayoutComponent 时的百分比位置路径，父尺寸变化由示例显式调用 `updateSizeAndPosition`。省略百分比尺寸、组件自动布局、节点生命周期、渲染与输入。

## 运行

在本目录执行：

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/ui/UIWidget.cpp -o /tmp/cocos2d-4x-s36
/tmp/cocos2d-4x-s36
~~~
