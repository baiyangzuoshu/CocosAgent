# 第 11 课：纹理数据、上传与 UV 坐标

把一张 2×2 RGBA 像素图贴到矩形上，按 `F` 翻转 V 坐标，观察纹理采样方向如何改变。

## 学完后你能

- 说明 CPU 像素字节如何通过 `glTexImage2D` 上传到 GPU 纹理。
- 区分纹理像素数据、纹理对象和 shader 中的采样结果。
- 根据顶点 UV 解释图像哪一部分映射到矩形的哪个角。
- 说明翻转 UV 与改写像素数据是两种不同操作。

## 运行

需要 CMake 3.20 或更新版本、C++17 编译器、OpenGL 开发库、GLFW 3，以及为 OpenGL 3.3 Core 生成的 GLAD 1。依赖由本机提供，课程不会自动下载或安装。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s11_texture_data_uv
```

- `F`：在原始 UV 与 V 坐标翻转之间切换。
- `Esc`：关闭窗口。

画面中的蓝、黄、红、绿四个区域来自一张在代码中生成的 2×2 RGBA 像素图，不依赖外部图片文件。按 `F` 后，上下两行交换位置，左右方向不变。

## 跟着代码走

示例代码在 [`src/main.cpp`](src/main.cpp)，构建配置在 [`CMakeLists.txt`](CMakeLists.txt)。矩形每个顶点都携带位置和 UV 两组属性；顶点着色器把 UV 传给片段着色器，片段着色器再从 `sampler2D` 读取颜色。

### CPU 字节上传为纹理

像素数组按 OpenGL 纹理数据的行顺序编排：第一行是图像底边，第二行是顶边；每个像素四个字节，依次为 R、G、B、A。

```cpp
glBindTexture(GL_TEXTURE_2D, texture);
glTexImage2D(
    GL_TEXTURE_2D, 0, GL_RGBA8, 2, 2, 0,
    GL_RGBA, GL_UNSIGNED_BYTE, pixels.data()
);
```

`GL_RGBA8` 指定 GPU 纹理的内部存储格式；`GL_RGBA` 和 `GL_UNSIGNED_BYTE` 描述 CPU 输入数据。程序还设置了 `GL_UNPACK_ALIGNMENT`、`GL_NEAREST` 和 `GL_CLAMP_TO_EDGE`，让这张小图的字节布局与采样结果保持明确。本课固定采样状态，过滤和寻址的细节留到下一课。

上传只创建并填充纹理存储，不会自动把它画到矩形上。绘制时程序激活纹理单元 `GL_TEXTURE0`、绑定纹理对象，并让 `uTexture` 采样器使用纹理单元编号 `0`。

### UV 决定采样位置

UV 是顶点属性，不是像素坐标。矩形左下角使用 `(0, 0)`，右上角使用 `(1, 1)`；三角形内部的 UV 会插值到片段着色器。

本例的角点关系如下：

| UV 区域 | 纹理颜色 |
| --- | --- |
| 左下 `(0, 0)` | 蓝色 |
| 右下 `(1, 0)` | 黄色 |
| 左上 `(0, 1)` | 红色 |
| 右上 `(1, 1)` | 绿色 |

按 `F` 时 shader 把每个顶点的 `v` 替换为 `1 - v`。像素数组与纹理对象都不变；采样坐标改了，因此上、下行交换。若从文件解码图片，解码器的首行方向需要单独确认，不能假设所有图片字节都与本例一样按底行开始。

## 动手观察

1. 对照像素数组和表格，指出矩形左上角为什么显示红色。
2. 按 `F`，观察上下颜色交换；确认左右颜色顺序未变。
3. 暂时把 shader 中的 `1.0 - aTexCoord.y` 改为 `1.0 - aTexCoord.x`，比较水平翻转。
4. 改动像素数组中一种颜色，再观察纹理上传后的结果；不要改 UV，区分数据变化与坐标变化。

## 检查理解

- 顶点 UV 为什么会在三角形内部插值？
- `glTexImage2D` 的 internal format 与输入 format 分别描述什么？
- 纹理绑定到 `GL_TEXTURE0` 后，为什么还要给 `sampler2D` 设置 `0`？
- 翻转 V 坐标时，纹理对象或 CPU 像素数组是否发生变化？

## 对照引擎源码

- [Cocos2d-x 4.0 `CCTexture2D.cpp`](../../engine/cocos2d-x-4/cocos/renderer/CCTexture2D.cpp)：`initWithData` / `initWithImage` 处理输入像素数据、尺寸和像素格式。
- [Cocos2d-x 4.0 `TextureGL.cpp`](../../engine/cocos2d-x-4/cocos/renderer/backend/opengl/TextureGL.cpp)：`Texture2DGL::updateData` 设置 unpack 对齐、绑定纹理，并用 `glTexImage2D` 上传像素。
- Creator 3.8.7 [`webgl2-texture.ts`](../../engine/3.8.7engine/cocos/gfx/webgl2/webgl2-texture.ts) 管理 WebGL2 纹理资源；[`webgl2-commands.ts`](../../engine/3.8.7engine/cocos/gfx/webgl2/webgl2-commands.ts) 的 `copyBuffersToTexture` 路径根据纹理状态调用 `texImage2D` 或 `texSubImage2D`。

这里展示的是桌面 OpenGL 3.3 的 RGBA8 纹理路径。Cocos 还会处理多种像素格式、尺寸转换、压缩纹理和 mipmap；本例没有覆盖这些路径。
