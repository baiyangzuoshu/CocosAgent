# 第 65 课：Cocos2d-x 4.0 RenderTexture backend 目标

**本课问题：** 4.0 怎样让 RenderTexture 的颜色/深度附件进入 backend render pass？

## 本版渲染路径

RenderTexture.begin/end 仍通过 GroupCommand 和 CallbackCommand 确定目标作用域。onBegin 保存旧 viewport/附件，再调用 Renderer.setRenderTarget 更新 RenderPassDescriptor；绘制命令开始 backend render pass 时，CommandBufferGL 按描述绑定/配置 FBO。onEnd 恢复旧附件。与 3.x 的 RenderTexture::onBegin 直接 glBindFramebuffer 不同，4.0 把附件交给 backend。

## 源码位置

- [CCRenderTexture.cpp](../../engine/cocos2d-x-4/cocos/2d/CCRenderTexture.cpp)：begin/end 排入分组回调；onBegin/onEnd 设置和恢复附件。
- [CCRenderer.cpp](../../engine/cocos2d-x-4/cocos/renderer/CCRenderer.cpp)：setRenderTarget 更新 backend RenderPassDescriptor，beginRenderPass 调用 CommandBuffer。
- [RenderPassDescriptor.h](../../engine/cocos2d-x-4/cocos/renderer/backend/RenderPassDescriptor.h)：颜色、深度、模板附件描述。
- [CommandBufferGL.cpp](../../engine/cocos2d-x-4/cocos/renderer/backend/opengl/CommandBufferGL.cpp)：beginRenderPass 根据附件创建/绑定 OpenGL FBO。
- [CommandBufferMTL.mm](../../engine/cocos2d-x-4/cocos/renderer/backend/metal/CommandBufferMTL.mm)：Metal 后端使用自身 render pass 编码。

## 独立代码与简化

src/cocos/2d/ 与 src/cocos/renderer/ 分开保留 RenderTexture 作用域、Renderer 附件状态和 backend CommandBuffer。示例模拟 OpenGL 后端的附件提交，不创建真实 GPU 资源；Metal 仅列出对应源码。

## 编译运行

~~~
c++ -std=c++11 -Isrc src/main.cpp src/cocos/2d/CCRenderTexture.cpp src/cocos/renderer/CCRenderer.cpp src/cocos/renderer/backend/opengl/CommandBufferGL.cpp -o /tmp/cocos2d-4x-s65
/tmp/cocos2d-4x-s65
~~~

输出显示 RenderTexture 回调改变 Renderer 附件状态，CommandBufferGL 在 render pass 开始时应用它，结束后恢复旧目标。
