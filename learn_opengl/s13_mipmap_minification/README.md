# 第 13 课：Mipmap 与纹理缩小

并排比较同一张高频棋盘纹理：左侧只采样基础层，右侧使用 mipmap 链。上下键改变纹理密度，观察缩小采样带来的闪烁和 mipmap 稳定效果。

## 学完后你能

- 说明 mipmap 如何为同一纹理提供逐级缩小的图像层级。
- 区分只使用基础层的 `GL_LINEAR` 与跨 mip 层采样的 `GL_LINEAR_MIPMAP_LINEAR`。
- 解释纹理 minification 为什么会出现混叠，以及 mipmap 如何降低高频闪烁。

## 运行

需要 CMake 3.20 或更新版本、C++17 编译器、OpenGL 开发库、GLFW 3，以及为 OpenGL 3.3 Core 生成的 GLAD 1。依赖由本机提供，课程不会自动下载或安装。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s13_mipmap_minification
```

- `Up`：增加纹理重复次数，增强缩小采样。
- `Down`：减少纹理重复次数，最低为 4。
- `Esc`：关闭窗口。

左、右两幅画面使用相同的像素数据、几何尺寸、UV 密度和缓慢移动的纹理坐标。左侧只创建基础层并使用 `GL_LINEAR`；右侧生成完整 mipmap 链并使用 `GL_LINEAR_MIPMAP_LINEAR`。两侧放大过滤都固定为 `GL_LINEAR`。

## 跟着代码走

示例代码在 [`src/main.cpp`](src/main.cpp)，构建配置在 [`CMakeLists.txt`](CMakeLists.txt)。两张 64×64 单像素棋盘图都映射到方形矩形；默认把 UV 重复 32 次，因此每个屏幕像素需要表示多个纹理 texel。这模拟了远处纹理被缩小到屏幕上的高频采样情形。

程序逐渐偏移 UV。基础层画面可能出现随偏移变化的条纹或闪烁；mipmap 画面会根据缩小程度选择更小的层级，减少落到一个屏幕像素中的高频细节，因此变化更稳定。`Up` / `Down` 调整密度，便于观察从放大到强烈缩小的转变。

### Mipmap 层级与 min filter

右侧纹理调用 `glGenerateMipmap(GL_TEXTURE_2D)` 生成 64、32、16、8、4、2、1 像素等层级。每一级都是基础图像的缩小版本。采样时 GPU 根据纹理坐标在屏幕上的变化率估计所需细节层级。

```cpp
glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
glGenerateMipmap(GL_TEXTURE_2D);
```

左侧的 `GL_LINEAR` 只对基础层做线性过滤，不在 mip 层级间选择。右侧的 `GL_LINEAR_MIPMAP_LINEAR` 在每一层内做线性过滤，并在相邻 mip 层之间插值。这个跨层插值常称为 trilinear filtering。

Mipmap 不会改变原始基础图像；它为纹理缩小采样准备一组预先过滤的低分辨率版本。代价是额外纹理存储空间，并且物体远时高频细节会被平均掉。本例固定 `GL_LINEAR` 放大过滤，没有讨论缩小纹理的各向异性过滤。

## 动手观察

1. 默认密度下观察左、右画面的高频棋盘格；留意左侧条纹随 UV 偏移变化，右侧更接近稳定的灰色。
2. 连续按 `Up` 增加纹理重复次数，再按 `Down` 降低，观察两个面板差异随采样密度改变。
3. 把右侧 min filter 暂时改成 `GL_LINEAR_MIPMAP_NEAREST`，比较只选一个 mip 层与跨层插值的过渡。
4. 把棋盘改成较大的黑白色块，确认 mipmap 会平滑高频变化，也会损失远处的细节。

## 检查理解

- 一张 64×64 纹理为什么需要多个更小的 mip 层？
- 纹理坐标在屏幕上变化得越快，采样器为什么会选择更小的 mip 层？
- 左侧为什么即使磁性过滤固定为 `GL_LINEAR`，缩小后仍可能闪烁？
- `GL_LINEAR_MIPMAP_LINEAR` 比 `GL_LINEAR` 多做了哪一层插值？

## 对照引擎源码

- [Cocos2d-x 4.0 `TextureGL.cpp`](../../engine/cocos2d-x-4/cocos/renderer/backend/opengl/TextureGL.cpp)：`Texture2DGL::generateMipmaps` 调用 `glGenerateMipmap`；sampler 描述还会决定 min filter 是否使用 mip 层。
- Creator 3.8.7 [`webgl2-texture.ts`](../../engine/3.8.7engine/cocos/gfx/webgl2/webgl2-texture.ts) 保存纹理层级等 GPU 资源信息；[`webgl2-commands.ts`](../../engine/3.8.7engine/cocos/gfx/webgl2/webgl2-commands.ts) 在纹理上传路径检查 `GEN_MIPMAP` 标志并调用 `gl.generateMipmap`。

本例用重复 UV 控制缩小比率，没有创建三维地面或模拟相机远近变化；它单独展示 mipmap 对高频纹理缩小采样的影响。引擎还会按纹理类型、格式和设备能力决定是否生成 mipmap。
