# 第 56 课：2.x 视口与矩阵栈

**本课问题：** 2.x 如何把 Director 的投影配置和 CCCamera 的观察矩阵放进矩阵栈？

## 本版路径

2.x 的 Director 先调用 `setViewport()`，再用 Kazmath 的正交/透视矩阵写入投影矩阵栈。`CCCamera::locate` 在数据脏时重算 LookAt 矩阵，每次把缓存矩阵乘入当前矩阵。它仍是直接矩阵状态路径，没有 3.x 的 Camera 渲染循环和 Renderer 命令队列。

## 源码位置

- `engine/cocos2d-x-2/cocos2dx/CCDirector.cpp:374-380`：Director 设置默认视口。
- `engine/cocos2d-x-2/cocos2dx/CCDirector.cpp:387-454`：2D/3D 投影矩阵与矩阵栈操作。
- `engine/cocos2d-x-2/cocos2dx/CCCamera.cpp:73-88`：脏时更新 LookAt 矩阵，然后乘入当前矩阵。
- 前置课：[第 13 课：SpriteFrame 与纹理区域](../s13_sprite_frame/README.md)。

## 独立代码与简化

代码镜像 `CCDirector → CCGLView` 和 `CCCamera`，用日志呈现 Kazmath/矩阵栈调用，不计算矩阵数值，也不创建 OpenGL 上下文。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos2dx/CCDirector.cpp src/cocos2dx/CCCamera.cpp -o /tmp/cocos2d-2x-s56
/tmp/cocos2d-2x-s56
~~~

输出可见 2.x 的 `kmMat4LookAt` 缓存和每次 `kmGLMultMatrix` 两步。
