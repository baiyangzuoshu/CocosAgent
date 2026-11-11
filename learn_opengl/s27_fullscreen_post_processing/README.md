# 第 27 课：全屏后处理与多 Pass

先把一幅彩色几何图形绘制到纹理，再用全屏矩形采样它。数字键切换原图、灰度和 Sobel 边缘；模糊模式把一个二维核拆成水平与垂直两次采样，写入中间纹理后再显示。

## 学完后你能

- 区分场景绘制与全屏后处理 pass 的输入、输出和 viewport。
- 用屏幕矩形将场景颜色纹理送入片元 shader。
- 用亮度权重转换灰度，并用 Sobel 邻域采样找出边缘。
- 把二维高斯近似拆成水平和垂直两个一维 pass。
- 说明为什么每个 pass 要从一个纹理读取，并写到另一个目标，避免纹理反馈。

## 运行

需要 CMake 3.20 或更新版本、C++17 编译器、OpenGL 开发库、GLFW 3，以及为 OpenGL 3.3 Core 生成的 GLAD 1。依赖由本机提供，课程不会自动下载或安装。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s27_fullscreen_post_processing
```

- `1`：显示原图。
- `2`：切换到灰度。
- `3`：显示 Sobel 边缘。
- `4`：执行水平和垂直两次模糊 pass。
- `Space`：暂停或继续中心图形旋转。
- `Left` / `Right`：手动转动中心图形。
- `R`：恢复原图模式和初始动画状态。
- `Esc`：关闭窗口。

窗口可调整大小；固定 960 × 640 的中间结果按比例显示在窗口中央。标题会显示效果模式和当前 pass 数量。

## Pass 之间传递的图像

```text
彩色几何体 ──场景 pass──> SceneTexture
                              ├── 原图 / 灰度 / Sobel ──全屏 pass──> 默认 framebuffer
                              └── 水平模糊 pass ──> PingTexture
                                                     │
                                                     └──垂直模糊 pass──> 默认 framebuffer
```

`1`、`2`、`3` 都先把几何图形绘制到 `SceneTexture`，再运行一个屏幕 pass 输出到窗口。`4` 会多做一次 pass：先从 `SceneTexture` 水平采样、写入 `PingTexture`，然后从 `PingTexture` 垂直采样、写入默认 framebuffer。模糊核的每次采样偏移使用 `1 / textureSize`，这样窗口大小改变不会改变离屏滤波半径。

场景纹理只保存颜色，不需要深度附件。水平与垂直模糊分别使用不同的输入和输出纹理；不能把同一纹理同时当作当前绘制附件和 shader 输入，否则会形成读写反馈。本例两张离屏纹理固定尺寸，窗口缩放只改变最终显示 viewport。

## 效果原理

灰度模式对每个 RGB 颜色按亮度权重求值：

```glsl
float y = dot(color, vec3(0.2126, 0.7152, 0.0722));
```

边缘模式在中心像素周围读取 3 × 3 邻域，用 Sobel X/Y 核分别估算水平方向与垂直方向的亮度变化，再用梯度长度形成轮廓。模糊模式使用中心加两侧各四个采样点的高斯近似；因为权重可分离，水平与垂直两次一维卷积就能代替一次二维卷积，减少采样次数。

## 跟着代码走

示例代码在 [`src/main.cpp`](src/main.cpp)，构建配置在 [`CMakeLists.txt`](CMakeLists.txt)。

1. `createColorTarget` 创建 `SceneTexture` 和 `PingTexture` 对应的颜色附件 framebuffer。
2. 场景 pass 用彩色几何体填充 `SceneTexture`。
3. `drawPostprocess` 绑定一个输入纹理和滤镜模式，再绘制全屏矩形。
4. 模糊模式把方向分别设为 `(1, 0)` 与 `(0, 1)`，让两个 pass 通过中间纹理串联。
5. `letterboxViewport` 让最终图像在不同窗口大小下保持 3:2 比例。

把 `uFilterMode` 的 Sobel 分支改为输出原始中心采样值，再与原图比较；把模糊权重改成较窄或较宽，观察轮廓扩散程度。尝试将水平 pass 的输出误设为 `SceneTexture`，再说明为什么 pass 输入与输出不能别名到同一幅图像。

## 检查理解

- 为什么后处理通常先有一张场景颜色纹理？
- 屏幕矩形的 UV 怎样对应源纹理像素？
- Sobel 为什么需要同时计算水平和垂直梯度？
- 把二维高斯核分成两个一维核能减少什么成本？
- blur 模式的水平 pass 和垂直 pass 分别读、写哪张纹理？
- 如果改变离屏分辨率但没有更新 texel size，边缘与模糊采样会发生什么变化？

## 对照引擎源码

- Creator 3.8.7 [`post-process-builder.ts`](../../engine/3.8.7engine/cocos/rendering/post-process/post-process-builder.ts) 维护一组按顺序执行的后处理 pass，并根据相机是否启用后处理选择 pipeline；其中包含 TAA、FXAA、色彩分级、Bloom、FSR 等阶段。[`pass-context.ts`](../../engine/3.8.7engine/cocos/rendering/post-process/utils/pass-context.ts) 负责建立 render pass、附件尺寸和输入纹理，也提供屏幕 quad 绘制入口。
- Creator 3.8.7 内置 pipeline 的 [`builtin-pipeline.ts`](../../engine/3.8.7engine/editor/assets/default_renderpipeline/builtin-pipeline.ts) 中，FXAA pass 把场景颜色作为纹理输入，并用 `addFullscreenQuad` 写入颜色目标；FSR 先执行 EASU pass，再把中间纹理交给 RCAS pass；Bloom 则建立 prefilter、downsample、upsample 和 combine 多个 pass。这里的 `LoadOp`、`StoreOp` 和不同的资源名称对应本课的“目标纹理、pass 输入、pass 输出”概念。

本例使用桌面 OpenGL 3.3 的 RGBA8 颜色目标和简化的几何图形；没有实现 HDR、色调映射、FXAA、TAA、深度依赖效果、自动资源别名或完整 Render Graph。Creator 源码对照限于仓库中 3.8.7 的后处理构建与默认 pipeline builder，不代表其他后端的具体实现。
