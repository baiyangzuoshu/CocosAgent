# 第 11 课：不可见节点跳过整棵子树

**目标：** 看清隐藏父节点如何阻止自己和后代进入绘制。

## 本课增量

CCNode.visit 在入口处检查可见状态。HiddenGroup 不可见时直接返回，它下面可见的 HiddenChild 也不会执行 draw；其他节点仍按原有 zOrder 绘制。

## 源码位置

- `engine/cocos2d-x-2/cocos2dx/base_nodes/CCNode.cpp:806-812`：不可见节点在 visit 入口提前返回。

## 简化

只保留一个 visible 布尔值和递归剪枝；省略透明度、裁剪节点及 OpenGL 状态。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/CCScheduler.cpp src/cocos2dx/base_nodes/CCNode.cpp src/cocos2dx/support/component/CCComponent.cpp src/cocos2dx/support/component/CCComponentContainer.cpp src/cocos2dx/platform/CCFileUtils.cpp src/cocos2dx/textures/CCTextureCache.cpp src/cocos2dx/CCDirector.cpp -o /tmp/cocos2d-2x-s11
/tmp/cocos2d-2x-s11
~~~

输出包含 Background、Player、UI，不包含 HiddenGroup 或 HiddenChild。
