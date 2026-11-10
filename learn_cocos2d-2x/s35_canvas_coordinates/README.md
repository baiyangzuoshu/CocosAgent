# 第 35 课：设计分辨率与 Layer 根节点

**本课问题：** Cocos2d-x 2.x 如何把设计分辨率、视口策略和场景 Layer 接起来？

## 观察结果

设计分辨率为 960×640，窗口为 1280×720，使用 `kResolutionShowAll`。缩放为 1.125，视口为 `(100, 0, 1080, 720)`；`CCLayer` 中心映射到窗口中心 `(640, 360)`。

## 源码位置

- [`CCEGLViewProtocol::setDesignResolutionSize`](../../engine/cocos2d-x-2/cocos2dx/platform/CCEGLViewProtocol.cpp#L58) 计算设计尺寸、缩放与视口。
- [`CCDirector::getVisibleSize/getVisibleOrigin`](../../engine/cocos2d-x-2/cocos2dx/CCDirector.cpp#L577) 提供当前可见区域；[`CCLayer::init`](../../engine/cocos2d-x-2/cocos2dx/layers_scenes_transitions_nodes/CCLayer.cpp#L66) 初始化 Layer 尺寸。

本课代码：[视图协议](src/cocos2dx/platform/CCEGLViewProtocol.cpp)、[CCDirector](src/cocos2dx/CCDirector.cpp)、[CCLayer](src/cocos2dx/layers_scenes_transitions_nodes/CCLayer.cpp)、[演示入口](src/main.cpp)。

## 简化范围

示例只实现 `SHOW_ALL`、居中视口和中心点换算。省略 EGL/平台窗口、其他分辨率策略、Director 全局单例及渲染状态。

## 运行

在本目录执行：

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/platform/CCEGLViewProtocol.cpp src/cocos2dx/CCDirector.cpp src/cocos2dx/layers_scenes_transitions_nodes/CCLayer.cpp -o /tmp/cocos2d-2x-s35
/tmp/cocos2d-2x-s35
~~~
