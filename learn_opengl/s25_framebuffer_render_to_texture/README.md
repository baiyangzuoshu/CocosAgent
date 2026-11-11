# 第 25 课：Framebuffer 与 Render-to-Texture

先把旋转立方体绘制到一个离屏 framebuffer，再把它的颜色纹理贴到窗口中的矩形上。`G` 键切换彩色与灰度显示，直观看到第二次绘制是在采样第一阶段产出的纹理。

## 学完后你能

- 区分 framebuffer 对象与真正保存颜色像素的纹理附件。
- 说明颜色附件和深度模板附件在一轮离屏绘制中的职责。
- 检查 framebuffer 是否完整，并让离屏 viewport 与附件尺寸匹配。
- 按顺序完成场景 pass 与屏幕显示 pass。
- 解释为什么不能一边把纹理作为当前 framebuffer 的颜色附件写入，一边又在同一轮绘制中采样它。

## 运行

需要 CMake 3.20 或更新版本、C++17 编译器、OpenGL 开发库、GLFW 3，以及为 OpenGL 3.3 Core 生成的 GLAD 1。依赖由本机提供，课程不会自动下载或安装。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s25_framebuffer_render_to_texture
```

- `Space`：暂停或继续离屏场景的旋转。
- `Left` / `Right`：手动转动立方体。
- `G`：切换彩色显示与灰度显示。
- `R`：恢复初始角度、动画和彩色显示。
- `Esc`：关闭窗口。

窗口可调整大小。离屏目标保持 768 × 512，输出纹理按比例显示在窗口中央；多出的区域以黑色留边。窗口标题显示目标尺寸、暂停状态和当前显示模式。

## 两阶段绘制

```text
立方体顶点 ──场景 pass──> FBO
                           ├─ RGBA8 颜色纹理：保存可再次采样的画面
                           └─ DEPTH24_STENCIL8 renderbuffer：用于遮挡测试

FBO 颜色纹理 ──显示 pass──> 默认 framebuffer ──> 窗口
                             屏幕 shader 采样，可转为灰度
```

FBO 只是附件的组合与绘制目标；颜色值由颜色纹理保存，因此第二个 pass 能把它绑定为 `sampler2D`。深度模板 renderbuffer 只参与场景里的遮挡测试，本例不需要把它读回 shader。初始化时程序把纹理和 renderbuffer 附加到 FBO，并检查 `glCheckFramebufferStatus`；若附件缺失或组合不受支持，会报告错误并退出。

每帧先绑定离屏 FBO、把 viewport 设为 `768 × 512`、清除颜色与深度模板，然后绘制旋转立方体。接着绑定默认 framebuffer、清除窗口背景、计算保持 3:2 比例的 viewport，再把颜色纹理绑定到纹理单元 0 并绘制屏幕矩形。两次绘制的目标不同，采样颜色纹理时它已经不再是当前绘制附件，因此避免了读写同一附件的反馈问题。

屏幕 pass 中的灰度转换只作为纹理二次采样的可视化：它把 RGB 按亮度权重合成一个值。本课没有实现完整后处理管线，也没有动态调整离屏纹理尺寸；窗口大小变化只改变显示 viewport，不会重建附件。

## 跟着代码走

示例代码在 [`src/main.cpp`](src/main.cpp)，构建配置在 [`CMakeLists.txt`](CMakeLists.txt)。可以依次找到：

1. `createRenderTarget` 创建 RGBA8 纹理、深度模板 renderbuffer 与 framebuffer，并检查附件完整性。
2. 第一阶段把场景绘制到颜色纹理；`glViewport` 使用目标纹理尺寸而不是窗口尺寸。
3. 第二阶段解绑离屏目标，绑定该颜色纹理，在屏幕 shader 中调用 `texture`。
4. `letterboxViewport` 在窗口大小变化时计算显示区域，避免把固定比例的目标图像拉伸。

尝试调整 `kRenderWidth` 与 `kRenderHeight`，观察附件分辨率与屏幕显示分辨率是两个独立概念。再把第二阶段的 `glBindFramebuffer(GL_FRAMEBUFFER, 0)` 注释掉，观察把纹理仍作为绘制附件时又用于采样会导致未定义的反馈行为。

## 检查理解

- framebuffer 对象和颜色纹理分别保存什么？
- 为什么有颜色附件后，带深度测试的立方体仍需要深度附件？
- 离屏 pass 和窗口 pass 的 viewport 为什么可以不同？
- 为什么 `glCheckFramebufferStatus` 应放在附件设置后检查？
- 如果颜色纹理在第二次绘制时仍附着在当前 framebuffer 上，同时又被 shader 采样，会有什么问题？
- 本例把深度模板存进 renderbuffer 而不是纹理，意味着它不能直接用于什么操作？

## 对照引擎源码

- Cocos2d-x 4.0 [`CommandBufferGL.cpp`](../../engine/cocos2d-x-4/cocos/renderer/backend/opengl/CommandBufferGL.cpp) 的 `beginRenderPass` 转入 `applyRenderPassDescriptor`：根据外部颜色、深度或模板纹理选择生成的 FBO，绑定目标、附加纹理，并按描述符清除颜色/深度/模板缓冲。该实现的职责是把抽象 render-pass 描述落实为 OpenGL 状态；本例使用显式创建的 FBO 和附件，流程更直接。
- Creator 3.8.7 [`framebuffer.ts`](../../engine/3.8.7engine/cocos/gfx/base/framebuffer.ts) 暴露颜色纹理、深度模板纹理及 framebuffer 尺寸；[`define.ts`](../../engine/3.8.7engine/cocos/gfx/base/define.ts) 的 `FramebufferInfo` 将 render pass 与附件关联，`ColorAttachment` / `DepthStencilAttachment` 保存格式和 load/store 操作。WebGL2 实现 [`webgl2-framebuffer.ts`](../../engine/3.8.7engine/cocos/gfx/webgl2/webgl2-framebuffer.ts) 组装 GFX 视图；[`webgl2-commands.ts`](../../engine/3.8.7engine/cocos/gfx/webgl2/webgl2-commands.ts) 创建底层 framebuffer、连接颜色和深度模板附件、检查完整性，并在 `WebGL2CmdFuncBeginRenderPass` 中绑定目标、设置 viewport/scissor、处理 load 操作。

本例使用单个 RGBA8 颜色附件和一个深度模板 renderbuffer，未实现多重采样、多个颜色附件、HDR、深度纹理采样、动态分辨率、纹理反馈特效或完整 Render Graph。Creator 源码对照只覆盖仓库中 Creator 3.8.7 的 WebGL2 GFX 路径；其他图形后端的对象映射和 pass 行为需分别核对。
