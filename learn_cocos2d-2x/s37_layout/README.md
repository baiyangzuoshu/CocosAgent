# 第 37 课：CocoStudio Layout 水平排布

**本课问题：** CocoStudio Layout 如何把 Widget 子项按顺序排好？

## 观察结果

固定尺寸 400×80 的 Layout 使用 LAYOUT_LINEAR_HORIZONTAL。子项锚点在中心，垂直重力为居中；每项左右 margin 分别为 8 和 4。三项宽度 64、80、96 的中心位置为 [(40,40), (124,40), (224,40)]。加入宽度 72 的第四项后，访问 Layout 时重新计算为 [(40,40), (124,40), (224,40), (320,40)]。

## 源码位置

- [UILayout.h 的布局类型](../../engine/cocos2d-x-2/extensions/CocoStudio/GUI/Layouts/UILayout.h#L41)：包含绝对、线性横向/纵向和相对布局。
- [水平布局计算](../../engine/cocos2d-x-2/extensions/CocoStudio/GUI/Layouts/UILayout.cpp#L923)：读取子 Widget 的锚点、尺寸、gravity 和 margin 后设置位置。
- [sortAllChildren](../../engine/cocos2d-x-2/extensions/CocoStudio/GUI/Layouts/UILayout.cpp#L211)：排序子项后调用 doLayout。

本课代码：[Widget](src/extensions/CocoStudio/GUI/BaseClasses/UIWidget.h)、[布局参数](src/extensions/CocoStudio/GUI/Layouts/UILayoutParameter.h)、[Layout](src/extensions/CocoStudio/GUI/Layouts/UILayout.h)、[实现](src/extensions/CocoStudio/GUI/Layouts/UILayout.cpp)、[入口](src/main.cpp)。

## 简化范围

只实现线性水平布局、子项 margin 与垂直居中。保留 CocoStudio 的 Layout、Widget、LayoutParameter 职责，不包含背景、裁剪、相对布局、事件和渲染。

## 运行

在本目录执行：

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/extensions/CocoStudio/GUI/Layouts/UILayout.cpp -o /tmp/cocos2d-2x-s37
/tmp/cocos2d-2x-s37
~~~
