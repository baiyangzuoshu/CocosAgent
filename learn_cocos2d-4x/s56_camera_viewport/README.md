# 第 56 课：4.0 Camera 视口进入 backend

**本课问题：** 4.0 如何把 Camera 的视口状态交给 Renderer，再由 backend CommandBuffer 应用？

## 本版路径

Director 初始化默认投影；Scene 按 Camera render order 遍历相机。`Camera::apply` 不直接调用 `glViewport`，而是让 Renderer 保存视口。Renderer 在 render pass 开始时把视口交给 backend `CommandBuffer::setViewport`，再执行排队的绘制命令。这是 4.0 的后端边界，不能套用 3.x 的直接 GL 视口代码。

## 源码位置

- `engine/cocos2d-x-4/cocos/base/CCDirector.cpp:424-429`、`:590-644`：Director 默认视口与投影矩阵。
- `engine/cocos2d-x-4/cocos/2d/CCScene.cpp:160-172`、`:175-225`：Camera 排序和每相机绘制循环。
- `engine/cocos2d-x-4/cocos/2d/CCCamera.cpp:422-431`：Camera 将视口交给 Renderer。
- `engine/cocos2d-x-4/cocos/renderer/CCRenderer.cpp:520-526`、`:766-773`：Renderer 保存视口，并在 render pass 开始时设置 CommandBuffer。
- `engine/cocos2d-x-4/cocos/renderer/backend/CommandBuffer.h:78-85`：backend 视口接口。
- 前置课：[第 13 课：SpriteFrame 与纹理区域](../s13_sprite_frame_texture/README.md)。

## 独立代码与简化

示例保留 `Scene → Camera → Renderer → backend CommandBuffer` 路径，用两台相机展示各自视口如何进入 render pass。它只输出调用顺序，不创建 GL/Metal 上下文，也不提交真实 GPU 命令。

## 编译运行

~~~sh
c++ -std=c++11 -Isrc src/main.cpp src/cocos/base/CCDirector.cpp src/cocos/2d/CCCamera.cpp src/cocos/2d/CCScene.cpp src/cocos/renderer/CCRenderer.cpp -o /tmp/cocos2d-x-s56
/tmp/cocos2d-x-s56
~~~

输出应先处理 `Main`，再处理 `Overlay`；每个相机的 viewport 都通过 backend CommandBuffer 记录。
