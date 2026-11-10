# 第 17 课：深度缓冲与深度测试

并排绘制两个提交顺序相反的场景：左侧先画远处蓝色矩形，右侧先画近处橙色矩形。按 `D` 切换深度测试，观察深度缓冲能否让两边得到相同的遮挡结果。

## 学完后你能

- 说明深度缓冲如何为屏幕像素保存当前最靠近相机的深度。
- 解释 `GL_DEPTH_TEST`、深度比较函数和深度写入掩码各自的作用。
- 用 `GL_LESS` 说明为什么先画远处、后画近处仍能得到正确遮挡。
- 观察关闭深度测试后，绘制顺序如何重新决定重叠区域的颜色。

## 运行

需要 CMake 3.20 或更新版本、C++17 编译器、OpenGL 开发库、GLFW 3，以及为 OpenGL 3.3 Core 生成的 GLAD 1。依赖由本机提供，课程不会自动下载或安装。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s17_depth_buffer_test
```

- `D`：开启 / 关闭深度测试。
- `Esc`：关闭窗口。

窗口标题显示测试状态和两个面板的绘制顺序。初始状态开启深度测试，两个面板的重叠区域都应由近处橙色矩形覆盖。

## 跟着代码走

示例代码在 [`src/main.cpp`](src/main.cpp)，构建配置在 [`CMakeLists.txt`](CMakeLists.txt)。程序请求深度缓冲，并在每帧开始时把深度清为 `1.0`。蓝色矩形的 NDC 深度为 `0.35`，橙色矩形为 `-0.35`；默认深度范围会把它们映射到窗口深度约 `0.675` 和 `0.325`，因此橙色矩形更近。

### 比较并写入深度

本例使用 `GL_LESS`，每个片段只有在新深度小于深度缓冲中已有的值时才通过。深度缓冲被清成 `1.0` 后，两个矩形第一次覆盖的像素都能通过；通过后，默认开启的深度写入会保存新深度。

```cpp
glEnable(GL_DEPTH_TEST);
glDepthFunc(GL_LESS);
glDepthMask(GL_TRUE);
glClearDepth(1.0);
glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
```

左面板先写入远处蓝色的深度，再让更近的橙色通过并覆盖它。右面板先写入近处橙色；随后远处蓝色的深度比较失败，重叠区域保留橙色。只要深度测试和写入都开启，两种提交顺序就会得到相同的遮挡结果。

按 `D` 关闭深度测试后，片段不再与深度缓冲比较，重叠区域由最后画出的矩形覆盖：左侧是橙色，右侧是蓝色。程序每帧仍清理颜色和深度缓冲，避免上一帧的数据影响当前结果。

### 测试、比较和写入是不同操作

`glEnable(GL_DEPTH_TEST)` 控制是否做深度比较；`glDepthFunc(GL_LESS)` 选择比较规则；`glDepthMask(GL_TRUE)` 允许通过测试的片段更新深度缓冲。它们彼此独立。本例固定使用 `GL_LESS` 和开启写入，只切换测试开关。第 15 课关闭透明层的深度写入，正是为了让后绘制的透明层仍能参与混合；这里展示的是两块不透明物体，深度写入保持开启。

## 动手观察

1. 在初始 `ON` 状态下确认左右重叠区域相同，即使两面板绘制顺序相反。
2. 按 `D` 关闭测试，观察左、右面板的颜色变化由各自最后绘制的矩形决定。
3. 再开启测试，把 `glDepthFunc(GL_LESS)` 改成 `GL_ALWAYS`，观察比较规则如何让后提交的片段总通过。
4. 把 `glDepthMask(GL_TRUE)` 改成 `GL_FALSE`，观察测试仍然执行，但深度缓冲不再记住已通过片段的深度。

## 检查理解

- 为什么把深度缓冲清成 `1.0` 后，较小的窗口深度通常更靠近相机？
- 深度测试通过后，哪个状态决定新深度是否写回深度缓冲？
- 如果开启深度测试却关闭深度写入，右面板的远处矩形还会通过吗？为什么？
- 为什么每帧要同时清理颜色缓冲和深度缓冲？

## 对照引擎源码

- Cocos2d-x 4.0 [`DepthStencilStateGL.cpp`](../../engine/cocos2d-x-4/cocos/renderer/backend/opengl/DepthStencilStateGL.cpp) 分别应用 `depthTestEnabled`、`depthWriteEnabled` 和比较函数；[`CommandBufferGL.cpp`](../../engine/cocos2d-x-4/cocos/renderer/backend/opengl/CommandBufferGL.cpp) 的 `prepareDrawing` 应用该状态。
- Creator 3.8.7 [`pipeline-sub-state.ts`](../../engine/3.8.7engine/cocos/gfx/base/pipeline-sub-state.ts) 的 GFX `DepthStencilState` 分别保存 `depthTest`、`depthWrite` 与 `depthFunc`；WebGL2 [`webgl2-commands.ts`](../../engine/3.8.7engine/cocos/gfx/webgl2/webgl2-commands.ts) 将它们映射到 `DEPTH_TEST`、`depthMask` 与 `depthFunc`。

本练习使用直接写入裁剪空间深度的平面矩形，不含相机矩阵、透视深度非线性、透明物体或多重采样。它用于隔离深度比较的基本行为，不替代引擎完整渲染管线的运行验证。
