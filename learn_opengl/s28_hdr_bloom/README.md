# 第 28 课：HDR 与 Bloom

本课把简化的霓虹场景画进 `RGBA16F` 浮点颜色目标，让发光区域保留大于 `1.0` 的线性亮度。随后提取超过阈值的区域、缩小并模糊，最后把 Bloom 加回场景，经曝光和色调映射显示到窗口。

## 学完后你能

- 说明普通 8 位颜色目标为什么不能保留大于 `1.0` 的场景亮度。
- 用浮点颜色附件保存 HDR 辐射值，并在最终显示前做色调映射。
- 从场景颜色中提取亮区，生成低分辨率 Bloom 输入。
- 用水平和垂直两个一维卷积模糊亮区，再与 HDR 场景合成。
- 分辨曝光控制的是整体显示映射，Bloom 强度控制的是合成光晕的权重。

## 运行

需要 CMake 3.20 或更新版本、C++17 编译器、桌面 OpenGL 3.3、GLFW 3，以及为 OpenGL 3.3 Core 生成的 GLAD 1。依赖由本机提供，课程不会自动下载或安装。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s28_hdr_bloom
```

- `1`：只显示 HDR 场景，经色调映射后输出。
- `2`：显示 HDR 场景加 Bloom。
- `3`：显示亮区提取结果。
- `4`：显示模糊后的 Bloom 纹理。
- `Up` / `Down`：增加或降低曝光。
- `Left` / `Right`：降低或增加 Bloom 强度。
- `R`：恢复 Bloom 合成模式与默认参数。
- `Esc`：关闭窗口。

标题会显示当前查看阶段、曝光、Bloom 强度和 pass 数。窗口缩放只改变最终显示 viewport；场景颜色目标保持 `960 × 640`，Bloom 目标保持其一半分辨率。

## 图像如何流动

```text
几何体辐射值
      │
      ▼
SceneHDR (960 × 640, RGBA16F)
      │
      ├── 模式 1 ────────────────────────────────┐
      │                                            │
      └── 亮区提取与降采样 ──> BloomA (480 × 320) │
                                    │               │
                             水平模糊 pass          │
                                    ▼               │
                               BloomB               │
                                    │               │
                             垂直模糊 pass          │
                                    ▼               │
                               BloomA               │
                                    └──────┬────────┘
                                           ▼
                              HDR 合成 → 曝光/色调映射
                                           │
                                           ▼
                                 gamma 输出到窗口
```

场景 pass 输出线性辐射值；亮区提取 pass 在半分辨率目标上采样场景纹理并执行阈值判断。`1` 只需场景和最终显示两个 pass；`3` 额外执行亮区提取；`2`、`4` 还会执行水平与垂直模糊，总计五个 pass。`3`、`4` 是调试视图，便于区分提取范围和模糊范围。

亮区提取使用简单硬阈值：最大颜色通道高于 `1.0` 时保留原始辐射值，否则写入黑色。目标尺寸减半，线性纹理采样会在缩小时混合相邻像素，降低后续模糊的像素成本。模糊使用中心与两侧各四个采样点的可分离高斯近似：水平 pass 从 `BloomA` 读、写 `BloomB`；垂直 pass 从 `BloomB` 读、写回 `BloomA`。每个 pass 的输入纹理都与当前颜色附件不同。

最终合成使用 `scene + bloom × bloomStrength`，再以 `1 - exp(-radiance × exposure)` 做简化色调映射，并用近似 `2.2` 的 gamma 编码送到默认 framebuffer。浮点目标让亮部在映射前保留强度差异；如果先写进 8 位目标，超出范围的亮度会丢失，后面就无法还原高亮之间的差别。

## 跟着代码走

示例代码在 [`src/main.cpp`](src/main.cpp)，构建配置在 [`CMakeLists.txt`](CMakeLists.txt)。

1. `createColorTarget` 为 `SceneHDR`、`BloomA` 和 `BloomB` 建立 `RGBA16F` 颜色纹理与 framebuffer。
2. 场景顶点直接携带线性辐射值；发光物体使用大于 `1.0` 的颜色值。
3. `drawPostPass` 先执行阈值提取，再执行水平或垂直高斯近似。
4. `drawComposite` 根据查看模式显示 HDR 场景、亮区、模糊结果或 Bloom 合成。
5. `exposure` 和 `bloomStrength` 分开调节，观察整体映射与光晕叠加的区别。

把 `uThreshold` 从 `1.0` 调高，观察哪些光源不再进入 Bloom；把 `RGBA16F` 改成 `RGBA8` 并比较亮部层次；把 Bloom 目标改回全分辨率，观察带宽和光晕细节的变化。当前示例使用硬阈值和固定半分辨率，没有实现软膝阈值、自动 mip 链、HDR 天空盒或物理相机曲线。

## 检查理解

- HDR 颜色值为什么可以大于 `1.0`？
- 阈值提取为什么要发生在色调映射之前？
- 为什么 `RGBA8` 目标会压掉高亮值之间的差别？
- Bloom 的亮区纹理为什么可以比场景纹理更小？
- 水平与垂直模糊 pass 分别读取和写入哪张纹理？
- 曝光和 Bloom 强度各自改变了图像处理流程的哪一部分？

## 对照 Creator 3.8.7 源码

- [`builtin-pipeline.ts`](../../engine/3.8.7engine/editor/assets/default_renderpipeline/builtin-pipeline.ts) 的 `BuiltinBloomPassBuilder` 根据 Bloom 类型选择 Kawase Dual Filter 或 Mipmap Filter 路径。Kawase 路径建立逐级缩小的 Bloom 目标，再组织 prefilter、downsample、upsample 和 combine pass；Mipmap 路径也使用多个尺寸的中间纹理。两条路径都将场景辐射纹理作为输入，并使用设置中的阈值与强度。
- HDR 输出格式也由管线条件决定：内置完整管线启用且 `CC_USE_FLOAT_OUTPUT` 为真时，Creator 3.8.7 把辐射目标设为 `RGBA16F`，否则使用 `RGBA8`。相关逻辑位于同一文件的 `cameraConfigs.radianceFormat` 配置处。内置材质资源 [`builtin-mipmap-bloom.mtl`](../../engine/3.8.7engine/editor/assets/default_renderpipeline/builtin-mipmap-bloom.mtl) 和 [`builtin-kawase-bloom.mtl`](../../engine/3.8.7engine/editor/assets/default_renderpipeline/builtin-kawase-bloom.mtl) 分别为两种路径提供材质配置。

本课是桌面 OpenGL 3.3 的简化实现：使用 `RGBA16F`、半分辨率硬阈值和可分离高斯近似。Creator 的 pass 数、目标尺寸、格式支持与 Bloom 算法取决于实际设置、设备格式能力和引擎路径；本例不代表 Creator 的完整效果或其他后端行为。
