# 第 22 课：多光源与衰减

一个球体同时接受方向光、点光和聚光。按 `1`、`2`、`3` 分别开关光源，比较单灯和叠加后的颜色；调整本地光源范围与聚光锥角，观察影响区域如何变化。

## 学完后你能

- 区分方向光、点光和聚光在方向、位置与影响范围上的差异。
- 写出每个光源的漫反射与镜面贡献，并把多个贡献累加到同一片元。
- 使用距离衰减限制点光和聚光的影响范围。
- 使用聚光内外角与 `smoothstep` 平滑锥形边界。
- 说明示例的范围衰减近似与物理上的平方反比衰减并不相同。

## 运行

需要 CMake 3.20 或更新版本、C++17 编译器、OpenGL 开发库、GLFW 3，以及为 OpenGL 3.3 Core 生成的 GLAD 1。依赖由本机提供，课程不会自动下载或安装。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s22_multi_light_attenuation
```

- `1`：开关方向光。
- `2`：开关点光。
- `3`：开关聚光。
- `[` / `]`：缩短 / 增加点光和聚光共用的范围。
- `Q` / `E`：收窄 / 扩大聚光的外锥全角。
- `Left` / `Right`：绕球转动相机；`Up` / `Down`：调整相机仰角。
- `R`：恢复所有光源、默认范围、锥角和相机。
- `Esc`：关闭窗口。

窗口标题显示三个光源的开关状态、范围和聚光外锥角。相机移动时，光源留在世界空间原位；转到球体背面后，当前视角看到的照明会自然变化。

## 跟着代码走

示例代码在 [`src/main.cpp`](src/main.cpp)，构建配置在 [`CMakeLists.txt`](CMakeLists.txt)。CPU 每帧提交相机、材质、三盏灯的位置/方向/颜色和控制参数；片元着色器对球面上的每个采样点计算光照。

设 `N` 是单位法线，`L` 是从表面指向光源的单位向量，`V` 是从表面指向相机的单位向量。每盏灯都计算 Lambert 漫反射和 Phong 镜面项：

```glsl
float diffuse = max(dot(N, L), 0.0);
vec3 R = reflect(-L, N);
float specular = diffuse > 0.0
    ? pow(max(dot(R, V), 0.0), shininess)
    : 0.0;
```

方向光在整个场景里使用同一个 `L`，不随片元位置变短，也不做距离衰减。点光和聚光先由光源位置 `lightPosition` 与片元位置 `P` 得到 `L = normalize(lightPosition - P)`。本例把光源的 `range` 当作衰减到零的边界：

```glsl
float x = distanceToLight / range;
float rangeAttenuation = clamp(1.0 - x * x, 0.0, 1.0);
```

聚光在范围衰减外再乘一项角度衰减。`D` 从聚光位置指向照明方向，`fromLightToFragment` 从光源指向当前片元；`innerCos > outerCos`：

```glsl
float coneCos = dot(normalize(fromLightToFragment), normalize(D));
float coneAttenuation = smoothstep(outerCos, innerCos, coneCos);
float attenuation = rangeAttenuation * coneAttenuation;
```

最终颜色只加一次环境底色，再累加所有启用灯光各自衰减后的漫反射和镜面项：

```glsl
color = ambient;
color += directionalContribution;
color += pointContribution * pointRangeAttenuation;
color += spotContribution * spotRangeAttenuation * spotConeAttenuation;
```

范围公式在 `d = range` 时归零，超过范围后也保持为零。它是易观察的有限范围淡出，不是现实光源常用的 `1 / d²` 能量衰减；它与 Cocos2d-x 4.0 这份内置 shader 的 `clamp(1 - dot(ldir, ldir), 0, 1)` 形式相似，其中 `ldir` 已按范围缩放。

## 动手观察

1. 只保留方向光，移动相机。受光区域由法线和固定方向决定，距离远近不会改变光照强度。
2. 关掉方向光，只开点光。按 `]` 增大范围，再按 `[` 缩短范围，注意衰减边界会在球面上移动。
3. 只开聚光，按 `Q` 和 `E` 改变外锥角。观察光斑边缘如何在内外锥之间平滑过渡。
4. 同时打开三盏灯。逐个关闭它们，观察各颜色贡献如何从总和中消失。
5. 把范围衰减替换成 `1.0 / (distance * distance)`，并比较远处亮度；注意这也会改变数值尺度，需要同步调整光强。
6. 把锥角衰减改成硬阈值，比较边缘是否出现突变。

## 检查理解

- 哪些方向量随片元位置变化？哪一种光的方向对整个物体固定？
- 为什么环境光只累加一次，而每盏直射光都单独计算漫反射和镜面项？
- 点光的距离衰减与聚光的角度衰减分别控制什么？
- `range` 在本例里代表什么？为什么它不等于平方反比衰减？
- 若聚光的 `D` 方向反了，锥形光斑会发生什么？

## 对照引擎源码

- Cocos2d-x 4.0 [`3D_colorNormalTexture.frag`](../../engine/cocos2d-x-4/cocos/renderer/shaders/3D_colorNormalTexture.frag) 分别遍历方向光、点光和聚光。`computeLighting` 使用法线与光向量的点积计算漫反射；点光和聚光先按光源范围计算距离衰减，聚光再按内外锥余弦值做 `smoothstep` 衰减。该 shader 的具体范围公式以源码为准，不应把它概括成物理平方反比。
- Creator 2.4.15 [`forward-renderer.js`](../../engine/2.4.15engine/cocos2d/renderer/renderers/forward-renderer.js) 的 `_updateLights` 更新并整理当前场景光源、更新光照宏；`_submitLightsUniforms` 将光源颜色、方向、位置、范围和聚光参数打包提交。这里展示的是前向渲染器的光源收集与 uniform 接线。
- Creator 3.8.7 [`render-scene.ts`](../../engine/3.8.7engine/cocos/render-scene/core/render-scene.ts) 管理主方向光、点光、聚光等不同集合，并在场景更新时更新光源；[`point-light.ts`](../../engine/3.8.7engine/cocos/render-scene/scene/point-light.ts) 与 [`spot-light.ts`](../../engine/3.8.7engine/cocos/render-scene/scene/spot-light.ts) 保存位置、范围、方向与锥角相关数据。它们说明场景层光源对象的职责；本例不据此推断 Creator 3.8 任一特定图形后端的 shader 公式。

本练习只实现一个平滑球体、固定材质、Phong 镜面项和三种实时光源。范围衰减与聚光边界采用简化模型；未实现阴影、点光阴影的多面体深度图、光照剔除、聚类/延迟光照、HDR 或 PBR。代码用于解释向量与衰减，不替代引擎的场景光源管理或渲染管线。
