# 第 35 课：设计分辨率与 Layer 根节点

**本课问题：** Cocos2d-x 3.x 如何由 GLView 适配设计分辨率，再让 Director 和 Layer 使用可见区域？

## 观察结果

设计分辨率为 960×640，窗口为 1280×720，使用 `ResolutionPolicy::SHOW_ALL`。缩放为 1.125，视口为 `(100, 0, 1080, 720)`；`Layer` 中心映射到窗口中心 `(640, 360)`。

## 源码位置

- [`GLView::setDesignResolutionSize`](../../engine/cocos2d-x-3/cocos/platform/CCGLView.cpp#L180) 设置设计分辨率并更新视图。
- [`Director::getVisibleSize/getVisibleOrigin`](../../engine/cocos2d-x-3/cocos/base/CCDirector.cpp#L812) 访问可见区域；[`Layer::init`](../../engine/cocos2d-x-3/cocos/2d/CCLayer.cpp#L72) 初始化 Layer 内容尺寸。

本课代码：[GLView](src/cocos/platform/CCGLView.cpp)、[Director](src/cocos/base/CCDirector.cpp)、[Layer](src/cocos/2d/CCLayer.cpp)、[演示入口](src/main.cpp)。

## 简化范围

示例只实现 `SHOW_ALL`、居中视口和中心点换算。省略平台窗口、其他策略、Director 单例和图形后端；没有引入 Creator 式 Canvas 组件。

## 运行

在本目录执行：

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/platform/CCGLView.cpp src/cocos/base/CCDirector.cpp src/cocos/2d/CCLayer.cpp -o /tmp/cocos2d-3x-s35
/tmp/cocos2d-3x-s35
~~~
