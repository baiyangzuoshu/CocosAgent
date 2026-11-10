# 第 16 课：三角形绕序与面剔除

旋转一个每面颜色不同的立方体，在模型外部和内部观察正面分类与面剔除。可以切换剔除模式，也可以把正面绕序从逆时针改成顺时针。

## 学完后你能

- 根据三角形在屏幕上的顶点绕序判断 OpenGL 如何分类正面和背面。
- 区分正面绕序设置 `glFrontFace` 与剔除选择 `glCullFace`。
- 说明为什么从立方体内部观察时，默认剔除背面会把内壁去掉。
- 观察绕序或剔除模式变化后，哪些立方体面会被提交到光栅化阶段。

## 运行

需要 CMake 3.20 或更新版本、C++17 编译器、OpenGL 开发库、GLFW 3，以及为 OpenGL 3.3 Core 生成的 GLAD 1。依赖由本机提供，课程不会自动下载或安装。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s16_face_culling_winding
```

- `C`：循环切换 `Back → Front → None` 剔除模式。
- `W`：切换正面绕序 `CCW` / `CW`。
- `I`：切换立方体外部视角和内部视角。
- `Esc`：关闭窗口。

窗口标题持续显示视角、剔除模式和当前绕序。立方体会自动旋转，每个面使用不同颜色，便于辨认保留下来的面。

## 跟着代码走

示例代码在 [`src/main.cpp`](src/main.cpp)，构建配置在 [`CMakeLists.txt`](CMakeLists.txt)。六个立方体面各由两个三角形组成，顶点顺序都按从外部观察为逆时针排列。示例启用深度测试，并请求深度缓冲；改变剔除状态不会关闭深度测试。

### 绕序决定正面分类

OpenGL 默认把窗口坐标中的逆时针绕序视为正面。`glFrontFace(GL_CCW)` 设置哪一种绕序算正面，`glCullFace(GL_BACK)` 则选择丢弃被分类成背面的三角形。它们是两项不同的状态：改变正面绕序会反转分类，改变剔除模式会改变丢弃哪一类。

立方体网格的顶点顺序始终不变。按 `W` 只会切换 `glFrontFace` 的设置；按 `C` 则会依次选择剔除背面、剔除正面或关闭剔除。关闭剔除时，正反两类三角形都会进入后续阶段，但深度测试仍会遮住更远的面。

### 从内部观察

初始视角在立方体外，使用 `CCW` 正面和背面剔除，保留朝外的表面。按 `I` 把相机放到立方体中心后，看到的是按外部绕序定义的背面；在当前默认的 `Back` 模式下，内壁会被剔除。再按一次 `C` 切到 `Front`，内壁就会显示出来。也可以试试关闭剔除，观察深度测试如何挑出离相机最近的内壁。

正反面分类依据三角形投影到窗口后的绕序，不是单看顶点法线，也不由颜色决定。本例没有加入法线、光照或模型贴图，以便把变化集中在绕序和剔除状态上。

## 动手观察

1. 在外部视角观察默认的 `CCW + Back`，再按 `C` 比较 `Front` 和 `None`。
2. 按 `W` 改变正面绕序，观察同一套顶点如何被重新分类。
3. 按 `I` 进入立方体内部；比较背面剔除、正面剔除和关闭剔除时的内壁。
4. 在 `None` 模式下仍能看到遮挡关系，解释这是深度测试而不是面剔除的结果。

## 检查理解

- 谁决定某个顶点绕序算正面：`glFrontFace` 还是 `glCullFace`？
- 关闭面剔除后，为什么立方体内部仍看不见被近处表面挡住的远处表面？
- 从模型内部看时，按外部绕序构建的表面为什么会变成背面？
- 如果不重排任何顶点，只把正面约定从 `CCW` 改成 `CW`，哪些三角形会改变分类？

## 对照引擎源码

- Cocos2d-x 4.0 [`CommandBufferGL.cpp`](../../engine/cocos2d-x-4/cocos/renderer/backend/opengl/CommandBufferGL.cpp) 的 `setCullMode` 保存剔除模式，`setWinding` 设置正面绕序；提交图元时根据模式启用或关闭 `GL_CULL_FACE`，并调用 `glCullFace`。[`UtilsGL.cpp`](../../engine/cocos2d-x-4/cocos/renderer/backend/opengl/UtilsGL.cpp) 把引擎的 `Winding` 与 `CullMode` 映射为 `GL_CCW` / `GL_CW` 和 `GL_BACK` / `GL_FRONT`。
- Creator 3.8.7 [`pipeline-sub-state.ts`](../../engine/3.8.7engine/cocos/gfx/base/pipeline-sub-state.ts) 的 `RasterizerState` 保存 `cullMode` 与 `isFrontFaceCCW`；WebGL2 [`webgl2-commands.ts`](../../engine/3.8.7engine/cocos/gfx/webgl2/webgl2-commands.ts) 将它们映射为 `CULL_FACE`、`cullFace` 和 `frontFace` 状态。

本例只演示桌面 OpenGL 3.3 的三角形和封闭立方体。它没有覆盖镜像变换对绕序的影响、双面材质策略、透明面的排序或不同引擎后端的具体性能；源码对照范围限定为所链接版本的 OpenGL 和 WebGL2 实现。
