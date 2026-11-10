# 第 37 课：ui::Layout 水平排布

**本课问题：** ui::Layout 如何把 Widget 子项排成一行，布局算法由谁执行？

## 观察结果

固定尺寸 400×80 的 Layout 使用 HORIZONTAL 类型。子项锚点在中心、垂直 gravity 为居中，每项 margin 为左 8、右 4。三项宽度 64、80、96 的中心位置为 [(40,40), (124,40), (224,40)]；加入宽度 72 的第四项后，下次 visit 调用布局，位置成为 [(40,40), (124,40), (224,40), (320,40)]。

## 源码位置

- [Layout 创建执行器并处理脏标记](../../engine/cocos2d-x-3/cocos/ui/UILayout.cpp#L943)：按布局类型选择 LinearHorizontalLayoutManager，执行后清除标记。
- [visit 中调用 doLayout](../../engine/cocos2d-x-3/cocos/ui/UILayout.cpp#L220)：绘制访问前先处理布局。
- [LinearHorizontalLayoutManager](../../engine/cocos2d-x-3/cocos/ui/UILayoutManager.cpp#L46)：按子项尺寸、锚点、gravity 和 margin 递推位置。

本课代码：[Widget](src/cocos/ui/UIWidget.h)、[LayoutParameter](src/cocos/ui/UILayoutParameter.h)、[Layout](src/cocos/ui/UILayout.h)、[LayoutManager](src/cocos/ui/UILayoutManager.h)、[执行器实现](src/cocos/ui/UILayoutManager.cpp)、[入口](src/main.cpp)。

## 简化范围

只实现水平布局、子项 margin 与垂直居中。保留 Layout 选择执行器、执行器遍历子项的职责；省略垂直/相对布局、裁剪、渲染、引用计数和完整 Widget 生命周期。本例以 visit 模拟一次绘制访问，不启动引擎。

## 运行

在本目录执行：

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/ui/UILayout.cpp src/cocos/ui/UILayoutManager.cpp -o /tmp/cocos2d-3x-s37
/tmp/cocos2d-3x-s37
~~~
