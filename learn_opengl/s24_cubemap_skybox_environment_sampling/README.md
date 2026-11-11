# 第 24 课：Cubemap、天空盒与环境采样

程序生成六个不同颜色的立方体贴图面。窗口用它绘制围绕相机的天空盒，并让中央球体沿反射方向采样同一份环境。转动相机时观察天空盒和反射如何同步变化。

## 学完后你能

- 说明 cubemap 是由六张同尺寸正方形面组成的纹理，而不是普通 2D UV 纹理。
- 理解 `samplerCube` 根据三维方向选择面并查找颜色。
- 用移除相机平移的天空盒绘制方式，让环境看起来位于无限远。
- 用入射方向、法线和 `reflect` 计算环境反射方向。
- 区分用于背景显示的 skybox 与用于表面反射采样的 cubemap。

## 运行

需要 CMake 3.20 或更新版本、C++17 编译器、OpenGL 开发库、GLFW 3，以及为 OpenGL 3.3 Core 生成的 GLAD 1。依赖由本机提供，课程不会自动下载或安装。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s24_cubemap_skybox_environment_sampling
```

- `Left` / `Right`：绕球转动相机；`Up` / `Down`：调整相机仰角。
- `S`：开关天空盒。
- `M`：在环境反射球与纯色球之间切换。
- `R`：恢复默认相机并开启两种效果。
- `Esc`：关闭窗口。

六个面由程序生成，依次对应 `+X`、`-X`、`+Y`、`-Y`、`+Z`、`-Z`。颜色和面内渐变用来辨认采样方向，不依赖外部图片。窗口标题显示当前天空盒与反射状态。

## 跟着代码走

示例代码在 [`src/main.cpp`](src/main.cpp)，构建配置在 [`CMakeLists.txt`](CMakeLists.txt)。`createCubemapTexture` 为 `GL_TEXTURE_CUBE_MAP_POSITIVE_X + faceIndex` 上传六个 RGBA 面，并使用线性过滤与 `GL_CLAMP_TO_EDGE`。每面宽高都相等；这里的 cubemap 只有一个 mip level。

### 用方向采样环境

普通 2D 纹理从 UV `(u, v)` 查颜色；`samplerCube` 接收方向向量。硬件根据方向分量最大的轴选择立方体面，再用剩余分量在该面上定位。对于反射球，若 `I` 从相机指向表面、`N` 是单位法线，则：

```glsl
vec3 I = normalize(worldPosition - cameraPosition);
vec3 R = reflect(I, normalize(worldNormal));
vec3 reflectedColor = texture(uEnvironment, R).rgb;
```

球体没有另外做漫反射或高光计算；这个 shader 把 cubemap 当作理想镜面环境颜色直接显示。它用于观察方向采样，不是完整的图像式照明或 PBR。

### 天空盒位于无限远

天空盒 shader 把立方体顶点位置直接当作环境方向，并使用相机的旋转基向量变换它。它不把相机位置平移加入天空盒顶点，因此相机绕原点移动时，背景不会显得像一块近处几何体。顶点输出把深度放到远平面，绘制时使用 `GL_LEQUAL` 并暂时关闭深度写入；随后正常绘制球体，让球体深度覆盖天空盒。程序关闭面剔除，让相机位于立方体内部时仍能绘制其表面。

同一个 cubemap 因而被两种方式消费：skybox 将方向直接作为采样坐标，反射球先根据观察方向和表面法线算出反射方向，再采样同一纹理。按 `S` 或 `M` 分别关闭它们可以看出这两种用途并不相同。

## 动手观察

1. 按 `M` 让球体在环境反射和纯色之间切换，确认 cubemap 采样影响球面颜色但不改变几何体轮廓。
2. 按方向键绕球转动相机，比较天空盒中的面如何移动，以及反射球上采样到的环境如何变化。
3. 按 `S` 关闭天空盒，反射球仍然可以采样 cubemap；再关闭反射，观察只剩纯色球和清屏背景。
4. 调换 `+X` 与 `-X` 两面的像素数据，观察方向到面的对应关系如何改变。
5. 把 cubemap 的 `GL_TEXTURE_MIN_FILTER` 改成 `GL_LINEAR_MIPMAP_LINEAR`，再生成 mipmap；确认没有 mipmap 时为何不应选择需要 mip 层的过滤方式。
6. 在 shader 中把反射方向改为 `reflect(-I, N)`，观察向量符号错误造成的环境翻转。

## 检查理解

- cubemap 的采样坐标为什么是三维方向，而不是 `(u, v)`？
- 六个面为什么必须是正方形且尺寸一致？
- 天空盒为什么不应该随相机平移？
- 为什么绘制天空盒时关闭深度写入，并在绘制球体前恢复深度状态？
- 同一张 cubemap 可以怎样分别用于天空背景和物体反射？这与漫反射 IBL 有何不同？

## 对照引擎源码

- Cocos2d-x 4.0 [`CCTextureCube.cpp`](../../engine/cocos2d-x-4/cocos/renderer/CCTextureCube.cpp) 接收按 `+X/-X/+Y/-Y/+Z/-Z` 顺序传入的六张图片，检查每面为同尺寸正方形，创建 `TEXTURE_CUBE` 并逐面上传；[`TextureGL.cpp`](../../engine/cocos2d-x-4/cocos/renderer/backend/opengl/TextureGL.cpp) 设置 cubemap 的过滤/寻址状态，并用 `GL_TEXTURE_CUBE_MAP_POSITIVE_X + face` 调用 `glTexImage2D`。
- Creator 3.8.7 [`texture.ts`](../../engine/3.8.7engine/cocos/gfx/base/texture.ts) 通过 `TextureInfo` 保存纹理类型与尺寸；[`define.ts`](../../engine/3.8.7engine/cocos/gfx/base/define.ts) 定义 `TextureType.CUBE`；WebGL GFX [`webgl-commands.ts`](../../engine/3.8.7engine/cocos/gfx/webgl/webgl-commands.ts) 将 CUBE 映射到 `TEXTURE_CUBE_MAP`，并按 `POSITIVE_X + faceIndex` 初始化各面和 mip level。

本例用运行时生成的彩色数据代替导入图片，只建立一个 cubemap 和一个平滑球体；面数据使用线性 `GL_RGBA8`，不做 sRGB 转换。未实现 HDR 环境、预过滤反射、辐照度卷积、粗糙度 LOD、重要性采样或漫反射 IBL；Creator 源码对照仅说明 GFX 纹理类型和 WebGL cubemap 面的创建路径，不代表其他后端的具体行为。
