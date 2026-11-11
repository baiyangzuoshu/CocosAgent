# 第 64 课：Cocos2d-x 4.0 Renderer 到 backend CommandBuffer

**本课问题：** 4.0 的绘制命令怎样经过 backend 接口到达图形 API？

## 本版渲染路径

Renderer 按队列处理 MeshCommand，再由 drawMeshCommand 转入 drawCustomCommand。Renderer 设置 RenderPass、Pipeline、ProgramState 和 Buffer，并调用 backend::CommandBuffer.drawElements。OpenGL 后端的 CommandBufferGL 在调用时直接执行 glDrawElements；Metal 有自己的 CommandBufferMTL 实现。4.0 的抽象边界在 backend 接口，不代表 OpenGL 后端会把 draw 延迟到帧末。

## 源码位置

- [CCRenderer.cpp](../../engine/cocos2d-x-4/cocos/renderer/CCRenderer.cpp)：beginFrame/endFrame、队列分派、drawMeshCommand 与 drawCustomCommand。
- [CommandBuffer.h](../../engine/cocos2d-x-4/cocos/renderer/backend/CommandBuffer.h)：backend 绘制接口。
- [DeviceGL.cpp](../../engine/cocos2d-x-4/cocos/renderer/backend/opengl/DeviceGL.cpp)：创建 CommandBufferGL 和 RenderPipelineGL。
- [CommandBufferGL.cpp](../../engine/cocos2d-x-4/cocos/renderer/backend/opengl/CommandBufferGL.cpp)：drawElements 准备状态后调用 OpenGL。
- [DeviceMTL.mm](../../engine/cocos2d-x-4/cocos/renderer/backend/metal/DeviceMTL.mm)：Metal 后端创建自己的 CommandBuffer。
- [CommandBufferMTL.mm](../../engine/cocos2d-x-4/cocos/renderer/backend/metal/CommandBufferMTL.mm)：Metal drawElements 实现。

## 独立代码与简化

src/cocos/renderer/ 保留 Renderer、CommandBuffer 接口、DeviceGL 工厂和 OpenGL 实现。示例用日志代替真实 GL 状态与 GPU 资源；Metal 路径列出源码位置，不在本示例中模拟。

## 编译运行

~~~
c++ -std=c++11 -Isrc src/main.cpp src/cocos/renderer/CCRenderer.cpp src/cocos/renderer/backend/DeviceGL.cpp src/cocos/renderer/backend/opengl/CommandBufferGL.cpp -o /tmp/cocos2d-4x-s64
/tmp/cocos2d-4x-s64
~~~

输出从 Renderer 进入 backend CommandBuffer，再由 OpenGL 实现调用 glDrawElements；Metal 可在源码中沿同一接口单独核对。
