# 第 56 课：1.x 视口与固定管线投影

**本课问题：** 1.x 怎样用 Director 设置全屏投影，再由 CCCamera 改变观察方向？

## 本版路径

1.x 的 `CCDirector::setProjection` 按投影类型直接调用视口和 OpenGL 固定管线函数；`CCCamera::locate` 在相机脏时直接调用 `gluLookAt`。这里没有后续版本的 Camera 渲染列表或 Renderer 命令队列。

## 源码位置

- `engine/cocos2d-x-1/cocos2dx/CCDirector.cpp:305-355`：`setProjection` 为 2D/3D 分支设置视口和投影/模型视图矩阵。
- `engine/cocos2d-x-1/cocos2dx/CCCamera.cpp:71-78`：脏相机直接调用 `gluLookAt`。
- 前置课：[第 13 课：SpriteFrame 与纹理区域](../s13_sprite_frame/README.md)。

## 独立代码与简化

代码镜像 `CCDirector → CCGLView` 和 `CCCamera` 两个职责；OpenGL 调用只打印轨迹，不创建图形上下文，也不计算真实矩阵。它展示 1.x 的直接调用路径，不模拟后续 Renderer 架构。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/CCDirector.cpp src/cocos2dx/CCCamera.cpp -o /tmp/cocos2d-1x-s56
/tmp/cocos2d-1x-s56
~~~

输出先显示 Director 配置视口和 2D 正交投影，再显示相机的 `gluLookAt`。
