# 第 23 课：线性颜色、sRGB 与 Gamma 校正

左右两个球使用相同材质、光线和线性空间光照。左侧把线性结果直接送到显示缓冲，右侧在输出前编码成 sRGB。窗口底部的黑、灰、白色块进一步比较：左侧在 sRGB 数值里取中点，右侧先在线性空间求平均再编码。

## 学完后你能

- 区分用于光照和混合的线性数值与用于存储/显示的 sRGB 编码值。
- 说明为什么 sRGB 输入颜色要先解码，再在线性空间做乘法、混合和光照。
- 使用 sRGB 分段函数在线性值与 sRGB 编码值间转换。
- 解释“Gamma 2.2”是常见近似，而不是 sRGB 的精确分段传递函数。
- 区分 sRGB 编码与 tone mapping：前者变换显示编码，后者压缩高动态范围亮度。

## 运行

需要 CMake 3.20 或更新版本、C++17 编译器、OpenGL 开发库、GLFW 3，以及为 OpenGL 3.3 Core 生成的 GLAD 1。依赖由本机提供，课程不会自动下载或安装。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s23_linear_color_srgb_gamma
```

- `Left` / `Right`：水平转动光照方向；`Up` / `Down`：升高 / 降低光照方向。
- `R`：恢复默认光照方向。
- `Esc`：关闭窗口。

窗口标题说明左右两侧的输出方式。两侧球体只在最终输出编码上不同；底部三个色块依次是黑、50% 中点、白。示例关闭 `GL_FRAMEBUFFER_SRGB`，由 shader 显式编码右侧输出，避免同一帧再被硬件重复编码。

## 跟着代码走

示例代码在 [`src/main.cpp`](src/main.cpp)，构建配置在 [`CMakeLists.txt`](CMakeLists.txt)。球体片元 shader 把设定的 sRGB 材质色解码成线性 RGB，再与线性光照相乘。左侧直接输出这个线性结果；右侧使用 sRGB 编码函数转换后输出。法线、光向量和材质在两侧完全相同。

对每个颜色通道，sRGB 解码为线性光强的标准分段关系是：

```text
C_linear = C_sRGB / 12.92                         if C_sRGB <= 0.04045
C_linear = ((C_sRGB + 0.055) / 1.055) ^ 2.4      otherwise
```

从线性光强编码到 sRGB：

```text
C_sRGB = 12.92 * C_linear                        if C_linear <= 0.0031308
C_sRGB = 1.055 * C_linear ^ (1 / 2.4) - 0.055   otherwise
```

Alpha 通道不做 sRGB 变换。颜色贴图（例如 base color）通常以 sRGB 编码；法线、粗糙度和金属度贴图是数据，应按线性数值读取，不要因为它们存成 8 位 RGB 就做 sRGB 解码。把黑与白在线性空间平均，得到 `0.5` 线性亮度；显示前编码为约 `0.735` sRGB（8 位约为 `188`）。直接平均两个 sRGB 码值则得到 `0.5`（约 `128`），它解码后只有约 `0.214` 线性亮度，因此视觉中点更暗。

左侧错误地把线性 shader 结果当作显示编码值。右侧在输出边界做 sRGB 编码，显示设备解码后恢复近似原线性亮度。若渲染目标本身是 sRGB 格式且启用了 `GL_FRAMEBUFFER_SRGB`，GPU 可以在写入时编码；这种情况下 shader 不应再手动重复编码。本练习使用默认窗口缓冲并关闭该状态，直接在 shader 里展示传递函数。

## 动手观察

1. 对比两个球的明暗：左侧直接输出线性值，右侧把相同线性值编码为 sRGB。
2. 比较左右面板底部的中间色块。它们来自相同的黑白端点，但中点分别为 `0.5` 与约 `0.735`。
3. 移动光照方向，观察同一套线性漫反射计算在两种输出编码下的差异。
4. 临时删掉 shader 中材质色的 sRGB 解码，观察把编码颜色直接用于光照乘法会造成什么变化。
5. 把精确分段函数替换成 `pow(c, 2.2)` 与 `pow(c, 1.0 / 2.2)`，比较中间暗部的差异。
6. 不要把 tone mapping 当作 sRGB 编码：可以先尝试 `color / (color + 1)` 压缩超出 1 的线性值，再单独进行 sRGB 编码。

## 检查理解

- 为什么不能直接把 sRGB 码值当作光强来平均或做光照乘法？
- 0.5 的 sRGB 值解码后为什么不是 0.5 线性亮度？
- sRGB 输入解码和最终输出编码分别应该放在哪个阶段？
- 如果 `GL_FRAMEBUFFER_SRGB` 已经自动编码，shader 又手动编码会发生什么？
- Gamma 2.2 近似与 sRGB 分段曲线有什么区别？tone mapping 又解决什么问题？

## 对照引擎源码

- Creator 3.8.7 [`define.ts`](../../engine/3.8.7engine/cocos/gfx/base/define.ts) 定义 `SRGB8`、`SRGB8_A8` 以及多种压缩 sRGB 格式；WebGL GFX 后端 [`webgl-commands.ts`](../../engine/3.8.7engine/cocos/gfx/webgl/webgl-commands.ts) 将 `Format.SRGB8_A8` 映射到 `SRGB8_ALPHA8_EXT`。这说明 GFX 格式和后端纹理格式之间的接线；实际采样/写入转换还取决于图形 API、资源格式和渲染状态。
- [`pipeline-funcs.ts`](../../engine/3.8.7engine/cocos/rendering/pipeline-funcs.ts) 提供 `SRGBToLinear` 与 `LinearToSRGB` 帮助函数；当前源码用平方与平方根作为近似，函数注释也保留了 2.2 次幂的替代写法。本课 shader 使用精确的 sRGB 分段函数，不能把课程公式说成该工具函数的逐字实现。
- 默认渲染管线的 [`builtin-tone-mapping.mtl`](../../engine/3.8.7engine/editor/assets/default_renderpipeline/builtin-tone-mapping.mtl) 是 tone mapping 材质资源，文件本身保存 EffectAsset 引用和 Pass 状态，不直接包含 tone mapping 公式。它作为后续 HDR/tone mapping 的入口；tone mapping 与这里讨论的 sRGB 输出编码是不同步骤。

本例只渲染一个漫反射球体和灰阶色块，没有纹理采样、硬件 sRGB FBO、色彩管理显示器、HDR 中间缓冲或 tone mapping 实现。左右显示差异用于观察传递函数；不同窗口系统与显示器的色彩管理可能影响最终屏幕观感。源码结论限于 Creator 3.8.7 仓库中的 GFX 定义、WebGL 映射和渲染工具函数。
