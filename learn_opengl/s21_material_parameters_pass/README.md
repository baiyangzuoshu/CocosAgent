# 第 21 课：材质参数与 Pass

同一个平滑球面在两种绘制方式下并排显示：左侧一次绘制合成环境光、漫反射和镜面项；右侧拆成基础光照 Pass 与加法镜面 Pass。切换材质参数，观察参数如何改变表面外观；按 `P` 关闭右侧第二个 Pass，单独观察它的贡献。

## 学完后你能

- 区分描述表面外观的材质参数与执行绘制的 Pass。
- 说明一个 Technique 可以组织一个或多个 Pass，Pass 会带着 shader 与管线状态提交绘制。
- 观察 `baseColor`、镜面强度和高光指数如何共同改变同一几何体的外观。
- 解释为什么多 Pass 可以把一个结果拆成多次绘制，以及每次绘制需要匹配自己的深度和混合状态。

## 运行

需要 CMake 3.20 或更新版本、C++17 编译器、OpenGL 开发库、GLFW 3，以及为 OpenGL 3.3 Core 生成的 GLAD 1。依赖由本机提供，课程不会自动下载或安装。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s21_material_parameters_pass
```

- `1` / `2` / `3`：选择 Warm gloss、Teal matte、Violet plastic 材质参数组。
- `P`：开启 / 关闭右侧的镜面 Pass。
- `Left` / `Right`：绕球转动相机；`Up` / `Down`：调整相机仰角。
- `R`：恢复默认材质、相机和 Pass 状态。
- `Esc`：关闭窗口。

窗口左侧是单 Pass 结果，右侧是双 Pass 结果。启用镜面 Pass 时，两边应接近相同；关闭后，右侧只剩环境光和漫反射，左侧仍保留完整材质效果。

## 跟着代码走

示例代码在 [`src/main.cpp`](src/main.cpp)，构建配置在 [`CMakeLists.txt`](CMakeLists.txt)。`MaterialParameters` 保存当前材质的基础颜色、镜面强度和高光指数。每次绘制都把这些值写入 shader uniforms；换预设只替换参数，不改变球体顶点或光源。

### 材质参数描述表面

本例的光照项可以拆成基础光照和镜面贡献：

```glsl
vec3 baseContribution = baseColor * ambientColor
    + baseColor * lightColor * diffuse;
vec3 specularContribution = lightColor * specular * specularStrength;
```

Warm gloss、Teal matte、Violet plastic 预设会分别改变 `baseColor`、`specularStrength` 和 `shininess`。这些值描述“表面看起来怎样”；它们本身不会指定渲染命令的混合、深度或剔除状态。

### Pass 描述一次绘制

左侧把两部分在一次 shader 执行中合成。右侧用相同几何体绘制两次：

1. 基础 Pass 输出环境光与漫反射，并写入颜色和深度。
2. 镜面 Pass 只输出高光，打开 `GL_ONE, GL_ONE` 加法混合；深度函数改为 `GL_LEQUAL`，并关闭深度写入，让它叠加到第一遍已经绘出的表面。

按 `P` 关闭第二遍后，右侧只剩基础光照。再开启后，镜面项被加回，和左侧单 Pass 的完整着色进行对照。程序为便于观察使用同一个 shader，并用输出模式选择 Pass 的颜色贡献；实际引擎中的不同 Pass 可以绑定不同的 shader、ProgramState 或管线状态。

## 动手观察

1. 按 `1`、`2`、`3` 切换参数组，确认几何体、光源和 Pass 结构都不变，表面颜色与高光却会改变。
2. 按 `P` 关闭镜面 Pass，比较右侧的基础光照和左侧完整结果；再开启，检查两种绘制方式是否接近。
3. 转动相机，观察同一材质参数下高光位置随视角变化。
4. 把 Pass 2 的混合改为关闭，观察镜面颜色如何覆盖基础颜色而不是叠加。
5. 在 Pass 2 重新开启深度写入，观察第二遍如何改变深度缓冲中的值。
6. 给材质预设增加一个参数，再决定它属于表面数据还是 Pass 状态，并说明理由。

## 检查理解

- `baseColor` 和 `GL_BLEND` 分别属于材质参数还是 Pass 管线状态？
- 为什么右侧第二遍需要加法混合？
- 两个 Pass 为什么要使用相同几何体、相机和深度结果？
- 关闭镜面 Pass 为什么会改变右侧颜色，却不改变球体轮廓？
- 同一 Material 有多个 Pass 时，为什么可能会重复提交同一网格？

## 对照引擎源码

- Cocos2d-x 4.0 [`CCMaterial.cpp`](../../engine/cocos2d-x-4/cocos/renderer/CCMaterial.cpp) 解析 Material 的 Technique、Pass、shader uniforms 和 render state；`Material::draw` 遍历当前 Technique 的 Pass 列表并逐个调用 `Pass::draw`。
- [`CCTechnique.cpp`](../../engine/cocos2d-x-4/cocos/renderer/CCTechnique.cpp) 维护 Pass 集合；[`CCPass.cpp`](../../engine/cocos2d-x-4/cocos/renderer/CCPass.cpp) 把 ProgramState、网格和矩阵/管线状态接到绘制命令上。
- Creator 3.8.7 [`material.ts`](../../engine/3.8.7engine/cocos/asset/assets/material.ts) 保存 EffectAsset、Technique 索引、Pass 列表和属性值；`Material.setProperty` 更新 shader 属性。`effect-asset.ts` 的 Technique/Pass 描述包含 shader 程序和 Pass 状态，运行时 [`pass.ts`](../../engine/3.8.7engine/cocos/render-scene/core/pass.ts) 持有 shader、blend、depth-stencil、rasterizer 等状态。 [`material-instance.ts`](../../engine/3.8.7engine/cocos/render-scene/core/material-instance.ts) 从父材质复制 Pass，并允许实例覆盖状态。

本例用 C++ 参数结构体近似 Material 数据，用显式绘制调用近似两个 Pass；它没有实现引擎的 Technique 选择、材质资产序列化、属性绑定、shader 变体、Pass 排序或批处理。代码演示的是职责关系，不是 Cocos 内部类的替代实现。
