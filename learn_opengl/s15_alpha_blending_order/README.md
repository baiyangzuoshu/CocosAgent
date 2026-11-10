# 第 15 课：Alpha 混合与透明绘制顺序

在两个相同的场景中叠加蓝色和橙色半透明矩形：左侧从远到近绘制，右侧故意反过来。上下键调整源 Alpha，观察混合公式和绘制顺序如何共同影响颜色缓冲。

## 学完后你能

- 说明 `GL_BLEND` 如何把片段源颜色与颜色缓冲中的目标颜色组合。
- 用 `glBlendFuncSeparate` 设置 RGB 与 Alpha 通道各自的混合因子。
- 解释为什么常规半透明物体通常要从远到近绘制。
- 区分深度测试和深度写入：透明层可以继续接受遮挡测试，同时不互相覆盖深度值。

## 运行

需要 CMake 3.20 或更新版本、C++17 编译器、OpenGL 开发库、GLFW 3，以及为 OpenGL 3.3 Core 生成的 GLAD 1。依赖由本机提供，课程不会自动下载或安装。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s15_alpha_blending_order
```

- `Up` / `Down`：增加 / 减少源 Alpha，每次 10%，范围为 10%–90%。Alpha 越高，源矩形越不透明。
- `Esc`：关闭窗口。

窗口标题标明左右面板的绘制顺序和当前源 Alpha。背景是不透明底色；两块前景矩形共用当前 Alpha。

## 跟着代码走

示例代码在 [`src/main.cpp`](src/main.cpp)，构建配置在 [`CMakeLists.txt`](CMakeLists.txt)。程序请求一个带深度缓冲的窗口，先绘制不透明底色，再开启混合并绘制两块透明矩形。两边的几何、颜色、深度和 Alpha 完全相同，只有两块透明矩形的提交顺序不同。

### 源颜色与目标颜色

开启混合后，OpenGL 把片段着色器输出称为源颜色，把当前颜色缓冲中已有的值称为目标颜色。本例采用 source-over 常用因子：

```cpp
glEnable(GL_BLEND);
glBlendFuncSeparate(
    GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA, // RGB
    GL_ONE, GL_ONE_MINUS_SRC_ALPHA        // Alpha
);
```

RGB 的加法混合结果为：

```text
Cout = Csrc × Asrc + Cdst × (1 − Asrc)
```

Alpha 通道使用单独的一组因子，结果为 `Aout = Asrc + Adst × (1 − Asrc)`。`glBlendFuncSeparate` 让颜色和 Alpha 通道不必共用同一套因子。单独设置 `uColor.a` 并不会自动让物体透明；还需要启用混合并选择混合因子。

### 为什么绘制顺序会改变结果

混合的目标颜色包含之前绘制留下的结果，所以先后执行两次混合通常不能交换顺序。左面板先画较远的蓝色，再画较近的橙色；右面板把这两次绘制反过来。绘制输入和深度都相同，只有顺序不同，重叠处颜色会明显变化。

两边都开启 `GL_DEPTH_TEST`，让前景矩形仍受不透明底色遮挡。画完底色后，程序对透明绘制调用 `glDepthMask(GL_FALSE)`，因此半透明矩形之间不写入深度缓冲；否则先画的近处矩形会挡掉随后绘制的远处矩形，无法展示混合顺序的影响。透明层画完后会恢复深度写入。

在常见的不透明/半透明流程中，先画不透明物体以填充深度缓冲，再把半透明物体从远到近提交。实际场景可能有相交表面或其他复杂情况，单一物体深度值排序并不能解决所有透明排序问题。

## 动手观察

1. 先比较左右两块矩形的重叠区域。左侧应表现为橙色覆盖蓝色，右侧则是蓝色覆盖橙色。
2. 按 `Up` 把 Alpha 调高，再按 `Down` 调低，观察前景颜色与底色的权重变化。
3. 暂时注释 `glDepthMask(GL_FALSE)`，比较深度写入如何影响右侧反向绘制的远处蓝色矩形。
4. 暂时注释 `glEnable(GL_BLEND)`，观察输出 Alpha 值本身并不等同于颜色混合。

## 检查理解

- `GL_SRC_ALPHA` 和 `GL_ONE_MINUS_SRC_ALPHA` 分别控制源颜色与目标颜色的什么权重？
- 为什么同一组透明矩形换个绘制顺序后会变色？
- 深度测试关闭与深度写入关闭有什么区别？本例为什么仍保留深度测试？
- 如果只改 `uColor.a`，但关闭 `GL_BLEND`，颜色缓冲会如何处理矩形？

## 对照引擎源码

- Cocos2d-x 4.0 [`CCRenderState.cpp`](../../engine/cocos2d-x-4/cocos/renderer/CCRenderState.cpp) 将 Blend 开关和混合因子写入管线描述；[`RenderPipelineGL.cpp`](../../engine/cocos2d-x-4/cocos/renderer/backend/opengl/RenderPipelineGL.cpp) 把描述映射为 `glEnable(GL_BLEND)`、`glBlendEquationSeparate` 与 `glBlendFuncSeparate`。[`CCRenderer.cpp`](../../engine/cocos2d-x-4/cocos/renderer/CCRenderer.cpp) 中透明 3D 命令进入单独队列，再按深度比较排序；`beginRenderPass` 会设置管线和深度状态。
- Creator 3.8.7 [`pipeline-state.ts`](../../engine/3.8.7engine/cocos/gfx/base/pipeline-state.ts) 持有 GFX `BlendState`；[`pipeline-sub-state.ts`](../../engine/3.8.7engine/cocos/gfx/base/pipeline-sub-state.ts) 定义每个 BlendTarget 的 Blend 开关、RGB/Alpha 混合因子和运算。WebGL2 [`webgl2-commands.ts`](../../engine/3.8.7engine/cocos/gfx/webgl2/webgl2-commands.ts) 应用 Blend 开关和 separate 因子；[`render-queue.ts`](../../engine/3.8.7engine/cocos/rendering/render-queue.ts) 的透明比较器会考虑优先级和 pass hash，再按深度从后向前、shader ID 排序；[`forward-stage.ts`](../../engine/3.8.7engine/cocos/rendering/forward/forward-stage.ts) 将 `BACK_TO_FRONT` 用于透明队列。

本练习仅有两块不相交深度平面、一个不透明底色和常规 source-over 因子。它不能覆盖预乘 Alpha、透明贴图边缘、物体相交、排序粒度或多重采样 Alpha-to-Coverage 等情况；这些都需要各自单独观察。
