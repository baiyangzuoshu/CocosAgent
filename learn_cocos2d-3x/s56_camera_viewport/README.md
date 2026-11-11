# 第 56 课：3.x Camera 驱动渲染循环

**本课问题：** 3.x 如何为每台 Camera 设置矩阵和视口，再逐台收集、执行 Renderer 命令？

## 本版路径

Director 先设置窗口默认投影。真正逐相机绘制时，Scene 按 Camera render order 排序；每台相机加载自己的 view-projection，`Camera::apply` 保存当前视口并直接调用 `glViewport`，Scene 访问节点、执行 Renderer 队列，最后恢复相机状态。源码还会按需切换 FBO；本例不配置离屏目标。Renderer 仍是 GL 命令队列，不是 4.0 的 backend CommandBuffer。

## 源码位置

- `engine/cocos2d-x-3/cocos/base/CCDirector.cpp:427-432`、`:635-689`：窗口视口和默认投影矩阵。
- `engine/cocos2d-x-3/cocos/2d/CCScene.cpp:175-187`、`:190-245`：相机排序，以及逐相机加载矩阵、访问场景、执行 Renderer、恢复状态。
- `engine/cocos2d-x-3/cocos/2d/CCCamera.cpp:437-500`：Camera 的 FBO/GL 视口应用与恢复。
- 前置课：[第 13 课：SpriteFrame 与纹理区域](../s13_sprite_frame_texture/README.md)。

## 独立代码与简化

示例保留 `Director → Scene → Camera → Renderer` 顺序，并以两台相机展示排序。GL、FBO 和渲染命令只打印，不创建图形上下文或执行真实绘制。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/base/CCDirector.cpp src/cocos/2d/CCCamera.cpp src/cocos/2d/CCScene.cpp -o /tmp/cocos2d-3x-s56
/tmp/cocos2d-3x-s56
~~~

输出应先绘制 `Main`，再绘制 `Overlay`；每台相机各自执行一次 Renderer 队列并恢复 GL 视口。
