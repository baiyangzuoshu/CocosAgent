# 第 12 课：Sampler 寻址与过滤

对照纹理坐标越界时的 `GL_REPEAT` / `GL_CLAMP_TO_EDGE`，再比较 `GL_NEAREST` / `GL_LINEAR` 的采样外观。

## 学完后你能

- 说明 S、T 寻址模式怎样处理超出 `[0, 1]` 的 UV。
- 区分最近邻取样与线性插值取样。
- 找到采样器设置与纹理数据上传之间的职责边界。

## 运行

需要 CMake 3.20 或更新版本、C++17 编译器、OpenGL 开发库、GLFW 3，以及为 OpenGL 3.3 Core 生成的 GLAD 1。依赖由本机提供，课程不会自动下载或安装。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s12_sampler_wrap_filter
```

| 按键 | 设置 |
| --- | --- |
| `R` | S/T 都使用 `GL_REPEAT` |
| `C` | S/T 都使用 `GL_CLAMP_TO_EDGE` |
| `N` | min/mag 都使用 `GL_NEAREST` |
| `L` | min/mag 都使用 `GL_LINEAR` |
| `Esc` | 关闭窗口 |

窗口标题会显示当前寻址与过滤模式。程序把一张 4×4 高对比像素图放大绘制，顶点 UV 从 `-0.5` 延伸到 `1.5`，因此能够同时观察纹理内外区域。

## 跟着代码走

示例代码在 [`src/main.cpp`](src/main.cpp)，构建配置在 [`CMakeLists.txt`](CMakeLists.txt)。像素数据和 `glTexImage2D` 上传方式沿用第 11 课；本课集中观察过滤与寻址状态。

为了少引入一个图形对象，本例用 `glTexParameteri` 把采样参数写在绑定的纹理对象上，没有创建独立的 OpenGL sampler object。Cocos2d-x 4.0 的 OpenGL 后端也会把 sampler 描述应用到纹理状态；Creator WebGL2 则创建独立的 `WebGLSampler`。

### 寻址模式：UV 超出纹理范围

纹理坐标的 S、T 分别沿图像横向与纵向变化。矩形覆盖的 UV 范围是 `[-0.5, 1.5]`：

- `GL_REPEAT` 按整数区间重复纹理，超出范围的区域继续显示重复图案。
- `GL_CLAMP_TO_EDGE` 把坐标限制到边缘 texel；矩形外侧会延伸纹理边缘的颜色。

按 `R` 和 `C` 对照画面。程序对 S、T 轴使用相同寻址模式，因此四条边都能看到变化。

### 过滤模式：一个 texel 显示成许多屏幕像素

- `GL_NEAREST` 取最近的 texel，像素边界清晰。
- `GL_LINEAR` 根据相邻 texel 的颜色做线性插值，边界呈现平滑过渡。

按 `N` 和 `L` 比较棋盘格与四角颜色。纹理被放大显示，所以本例主要观察放大过滤；代码同时把 min/mag 设成同一模式，便于看清状态变化。这里没有生成或使用 mipmap，第 13 课再观察纹理缩小时的 mipmap。

## 动手观察

1. 在最近过滤下切换 `R` / `C`，指出哪些区域重复，哪些区域显示被延伸的边缘颜色。
2. 保持 `GL_REPEAT`，切换 `N` / `L`，观察每个 texel 边界的变化。
3. 把顶点 UV 范围从 `[-0.5, 1.5]` 改回 `[0, 1]`，确认 Repeat 与 Clamp 的区别因此不再明显。
4. 尝试只修改 S 或只修改 T 的 wrap 参数，分别观察左右边缘与上下边缘。

## 检查理解

- 为什么 UV 全在 `[0, 1]` 时不容易看出 Repeat 与 Clamp 的差别？
- `GL_NEAREST` 与 `GL_LINEAR` 选择 texel 的方式有什么不同？
- 纹理像素存储格式与 sampler 过滤状态分别由哪段代码控制？
- 本例纹理在窗口中被放大时，主要使用 min 过滤还是 mag 过滤？

## 对照引擎源码

- [Cocos2d-x 4.0 `TextureGL.cpp`](../../engine/cocos2d-x-4/cocos/renderer/backend/opengl/TextureGL.cpp)：`updateSamplerDescriptor` 把采样描述中的过滤、S/T 寻址参数应用到 OpenGL 纹理状态。
- Creator 3.8.7 [`webgl2-sampler.ts`](../../engine/3.8.7engine/cocos/gfx/webgl2/states/webgl2-sampler.ts) 保存 sampler 描述并准备 WebGL2 sampler；[`webgl2-commands.ts`](../../engine/3.8.7engine/cocos/gfx/webgl2/webgl2-commands.ts) 中的 `WebGL2CmdFuncPrepareSamplerInfo` 把 filter/address 描述转换为 WebGL 状态。

桌面练习只对比 OpenGL 3.3 的 Repeat、Clamp-to-edge、Nearest 和 Linear。纹理格式支持、mipmap 过滤与引擎设备限制会在后续课程分别讨论。
