# 第 35 课：窗口点坐标与 Layer 根节点

**本课问题：** Cocos2d-x 1.x 如何给界面代码提供窗口坐标？

## 观察结果

窗口为 1280×720 点，内容缩放因子为 2，因此像素尺寸为 2560×1440。`CCLayer::init` 将 Layer 内容尺寸设为窗口点坐标尺寸，中心点为 `(640, 360)`。本版本这条路径没有设计分辨率适配策略，也没有 Creator 式 Canvas 组件。

## 源码位置

- [`CCDirector::getWinSize`](../../engine/cocos2d-x-1/cocos2dx/CCDirector.cpp#L457) 返回窗口点坐标；[`getWinSizeInPixels`](../../engine/cocos2d-x-1/cocos2dx/CCDirector.cpp#L473) 乘内容缩放因子。
- [`CCLayer::init`](../../engine/cocos2d-x-1/cocos2dx/layers_scenes_transitions_nodes/CCLayer.cpp#L54) 用 Director 的窗口尺寸初始化 Layer。

本课代码：[CCDirector](src/cocos2dx/CCDirector.cpp)、[CCLayer](src/cocos2dx/layers_scenes_transitions_nodes/CCLayer.cpp)、[演示入口](src/main.cpp)。

## 简化范围

示例只保留窗口点尺寸、像素尺寸和 Layer 内容尺寸。省略设备方向、真实 GLView、平台窗口创建和渲染。没有补造设计分辨率或 Canvas API。

## 运行

在本目录执行：

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/CCDirector.cpp src/cocos2dx/layers_scenes_transitions_nodes/CCLayer.cpp -o /tmp/cocos2d-1x-s35
/tmp/cocos2d-1x-s35
~~~
