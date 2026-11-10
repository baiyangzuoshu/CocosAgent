# 第 20 课：镜面高光与 Phong / Blinn-Phong

并排显示同一个平滑球面：左侧用 Phong 反射向量计算镜面高光，右侧用 Blinn-Phong 半程向量。用方向键绕球转动相机，再用方括号改变高光指数，观察高光如何跟随视角和参数变化。

## 学完后你能

- 区分环境光、漫反射项和镜面反射项。
- 写出 Phong 的反射向量 `R` 与 Blinn-Phong 的半程向量 `H`。
- 说明高光依赖观察方向，不能只由法线和光源方向决定。
- 观察 `shininess` 如何控制高光集中程度，以及同一指数下两模型的形状差异。

## 运行

需要 CMake 3.20 或更新版本、C++17 编译器、OpenGL 开发库、GLFW 3，以及为 OpenGL 3.3 Core 生成的 GLAD 1。依赖由本机提供，课程不会自动下载或安装。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s20_specular_phong_blinn
```

- `Left` / `Right`：绕球转动相机。
- `Up` / `Down`：升高 / 降低相机仰角。
- `[` / `]`：降低 / 增加镜面高光指数。
- `R`：恢复相机和高光参数。
- `Esc`：关闭窗口。

窗口左侧固定使用 Phong，右侧固定使用 Blinn-Phong。两个面板共用球体、方向光、材质色、环境项和高光指数；它们只改变镜面项的计算方式。

## 跟着代码走

示例代码在 [`src/main.cpp`](src/main.cpp)，构建配置在 [`CMakeLists.txt`](CMakeLists.txt)。球面顶点携带平滑法线；顶点着色器把位置变到观察空间并把世界位置与法线传给片段着色器。片段着色器分别计算两种镜面项，再把它们与共用的环境光、漫反射相加。

设 `N` 为单位法线，`L` 为从表面指向光源的单位向量，`V` 为从表面指向相机的单位向量。两种模型都先使用相同的 Lambert 项：

```glsl
float diffuse = max(dot(N, L), 0.0);
```

Phong 把入射方向 `-L` 关于法线反射为 `R`，再比较 `R` 和观察方向：

```glsl
vec3 R = reflect(-L, N);
float phongSpecular = pow(max(dot(R, V), 0.0), shininess);
```

Blinn-Phong 改用光照与观察方向的半程向量 `H`：

```glsl
vec3 H = normalize(L + V);
float blinnSpecular = pow(max(dot(N, H), 0.0), shininess);
```

只有 `dot(N, L) > 0` 时才累加高光，避免光源在表面背面时仍出现镜面项。最终颜色由环境底色、漫反射颜色和白色镜面项相加。增大 `shininess` 会让两种模型的高光更集中；相同数值不保证两种公式产生完全相同的高光宽度，因此应把指数当作各自公式的参数来观察。

相机转动会改变 `V`，即使光源和法线不变，高光位置与强度仍会变化。方向键只移动相机位置并始终让相机朝向球心；光源方向保持固定。

## 动手观察

1. 在默认视角比较两面板的高光位置和边缘形状。
2. 按方向键转动相机，观察高光随 `V` 改变；漫反射区域主要由 `N` 与 `L` 决定。
3. 按 `]` 逐步增加指数，观察高光从宽缓变得集中；按 `[` 再减小指数。
4. 把 Phong 项改成 `pow(max(dot(N, L), 0.0), shininess)`，观察它退化成只依赖法线与光源的错误镜面近似。
5. 暂时去掉 `dot(N, L) > 0` 的条件，检查背光面是否会出现不合理高光。
6. 让左右面板使用不同指数，再调整到近似相同的高光宽度，比较两个向量公式的参数尺度。

## 检查理解

- Phong 的 `R`、Blinn-Phong 的 `H` 分别由哪些方向向量构成？
- 为什么改变相机位置会改变镜面高光，但不会改变方向光的 Lambert 强度？
- 为什么在累加镜面项前还要检查 `dot(N, L)`？
- `shininess` 变大时，高光为什么更集中？
- 同一 `shininess` 数值能否保证 Phong 与 Blinn-Phong 有相同的高光宽度？

## 对照引擎源码

- Cocos2d-x 4.0 [`CCPass.cpp`](../../engine/cocos2d-x-4/cocos/renderer/CCPass.cpp) 缓存投影、模型视图与法线矩阵及灯光/环境光 uniform 位置，并在绘制前更新矩阵。它说明 Pass 如何向 shader 提供变换和光照状态。
- 内置 [`3D_colorNormal.frag`](../../engine/cocos2d-x-4/cocos/renderer/shaders/3D_colorNormal.frag) 的 `computeLighting` 实现法线与光方向的点积漫反射，片元主入口组合环境光和方向/点/聚光贡献；这个内置 shader 没有 Phong 或 Blinn-Phong 镜面项。本课在同一基础漫反射上自行增加镜面计算。

本练习固定一盏方向光、一个白色镜面反射项和一个平滑球面，未覆盖纹理/法线贴图、点光衰减、阴影、能量守恒或基于物理的材质。引擎源码对照范围仅限 Cocos2d-x 4.0 这组 Pass 与内置 shader。
