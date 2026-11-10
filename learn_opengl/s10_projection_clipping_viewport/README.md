# 第 10 课：投影、裁剪空间与视口

场景里有三块尺寸相同、深度不同的方块。本课切换透视/正交投影，再切换全窗口/居中方形视口，观察物体大小、裁剪边界和画面映射如何变化。

## 学完后你能

- 区分透视投影与正交投影对深度和物体尺寸的影响。
- 说明裁剪坐标如何经过透视除法变成 NDC。
- 说明 `glViewport` 如何把 NDC 映射到窗口像素范围。

## 运行

需要 CMake 3.20 或更新版本、C++17 编译器、OpenGL 开发库、GLFW 3，以及为 OpenGL 3.3 Core 生成的 GLAD 1。依赖由本机提供，课程不会自动下载或安装。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s10_projection
```

控制方式：

- `P`：切换透视投影。
- `O`：切换正交投影。
- `V`：切换全窗口视口与居中方形视口。
- 拖动窗口边缘：观察帧缓冲尺寸、宽高比和视口如何更新。
- `Esc`：关闭窗口。

三块蓝、橙、绿方块的世界尺寸相同，分别位于近、中、远三个深度；紫色方块靠近裁剪边界。几何体彼此错开，因此本例不需要深度测试。

## 跟着代码走

示例代码在 [`src/main.cpp`](src/main.cpp)，构建配置在 [`CMakeLists.txt`](CMakeLists.txt)。顶点位置已经处在相机坐标中，本课只计算 Projection 矩阵，不重复实现 Model 和 View。

### 投影到裁剪空间

顶点着色器使用 `uProjection`：

```glsl
gl_Position = uProjection * vec4(aPosition, 1.0);
```

透视投影让远处方块在投影后的尺寸变小；正交投影保留相同的世界尺寸。两种矩阵都使用当前视口的宽高比，并固定相同的 near/far 范围。

投影结果是齐次裁剪坐标 `(x_c, y_c, z_c, w_c)`。OpenGL 在透视除法前对图元做齐次裁剪：顶点的 x、y 或 z 超出 `[-w_c, w_c]` 时，对应图元部分会被裁掉；之后再除以 `w_c` 得到 NDC。紫色方块在透视模式下会被右侧/上侧裁剪；正交模式下它仍处在视锥范围内。

### NDC 映射到视口

透视除法后的 NDC 每轴范围是 `[-1, 1]`。`glViewport(x, y, width, height)` 把该范围映射到帧缓冲中的像素矩形。

- 全窗口模式把整个帧缓冲作为视口；窗口缩放时重新计算宽高比，避免方块被拉伸。
- 方形视口模式在窗口中央使用边长为短边的方形区域；周围保留清屏颜色，Projection 宽高比同步设为 1。

## 动手观察

1. 在透视模式中比较近、中、远方块的大小，再按 `O`，确认正交模式下三者世界尺寸相同时屏幕尺寸也相同。
2. 观察紫色方块：透视投影会裁掉越过裁剪面的部分，正交投影会完整显示。
3. 在两种视口模式之间切换，观察 NDC 内容在全窗口或方形区域中的映射位置和尺寸。
4. 拖动窗口改变宽高比，观察全窗口视口如何重算 Projection；方形视口则保持宽高比为 1。

## 检查理解

- 为什么透视投影的裁剪 `w_c` 会随顶点深度变化，而正交投影不会？
- 裁剪测试发生在透视除法前还是后？
- NDC 与窗口像素坐标之间由哪条 OpenGL 状态完成映射？
- 仅改变 `glViewport` 会不会改变 Projection 矩阵？本例为什么在视口尺寸变化时也重算矩阵？

## 对照引擎源码

- [Cocos2d-x `CommandBufferGL.cpp`](../../engine/cocos2d-x-4/cocos/renderer/backend/opengl/CommandBufferGL.cpp)：`setViewport` 直接调用 `glViewport` 并保存视口状态。
- [Creator 2.4.15 `camera.js`](../../engine/2.4.15engine/cocos2d/renderer/scene/camera.js)：按宽高比构造透视或正交 Projection，再计算 View-Projection。
- [Creator 3.8.7 `camera.ts`](../../engine/3.8.7engine/cocos/render-scene/scene/camera.ts)：根据相机投影类型、宽高比、near/far 和设备裁剪空间能力生成 Projection 矩阵。
- Creator 3.8.7 [`webgl2-primary-command-buffer.ts`](../../engine/3.8.7engine/cocos/gfx/webgl2/webgl2-primary-command-buffer.ts)：`setViewport` 把视口状态传给 `gl.viewport`，并更新状态缓存。

桌面练习展示 OpenGL 3.3 的默认裁剪空间和视口行为。Creator 源码可能按后端调整 Y 轴符号、最小 Z 或 surface orientation；这些桌面观察不能替代具体 Creator 平台验证。
