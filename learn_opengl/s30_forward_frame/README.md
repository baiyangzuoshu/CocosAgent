# 第 30 课：追踪一帧并完成小型前向渲染器

本课把前 29 课的变换、相机、深度、面剔除、光照和索引绘制连成一条可观察的帧流程。程序维护 6 个立方体对象；每帧处理输入和动画、做球体视锥筛选、按不透明物体的相机空间深度排序，再逐对象设置模型矩阵与颜色并调用索引绘制。

## 学完后你能

- 从输入、场景更新一路追踪到交换显示缓冲区。
- 区分 CPU 对象级视锥筛选与 GPU 对图元执行的裁剪。
- 解释不透明物体按相机深度排序与深度测试的关系。
- 找到模型矩阵、相机 View/Projection、绘制状态和索引调用各自的步骤。
- 说明本例为什么仍是逐对象提交，以及引擎的 2D batcher 会检查哪些兼容条件。

## 运行

需要 CMake 3.20 或更新版本、C++17 编译器、桌面 OpenGL 3.3、GLFW 3，以及为 OpenGL 3.3 Core 生成的 GLAD 1。依赖由本机提供，课程不会自动下载或安装。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s30_forward_frame
```

- `W` / `A` / `S` / `D`：沿相机方向移动。
- `Q` / `E`：降低或升高相机。
- 方向键：转动相机视角。
- `Space`：暂停或继续物体旋转。
- `F`：切换 CPU 球体视锥筛选。
- `C`：切换 GPU 背面剔除。
- `Z`：切换深度测试。
- `P`：切换线框显示。
- `R`：恢复相机和渲染状态。
- `Esc`：关闭窗口。

窗口标题显示当前可见对象数、draw call 数和关键状态。相机移动后可以观察 CPU 视锥筛选结果变化；关闭 `F` 会把全部对象送入绘制循环，仍由 GPU 的裁剪阶段处理视口外图元。

## 每一帧的步骤

```text
GLFW 输入
    │
    ▼
更新相机与旋转角度
    │
    ▼
球体视锥筛选 ──> 不透明物体按相机深度从近到远排序
    │
    ▼
绑定窗口 framebuffer、viewport 并清除颜色/深度
    │
    ▼
设置深度测试 / 背面剔除 / 填充模式
    │
    ▼
逐对象：Model × View × Projection → 法线光照 → glDrawElements
    │
    ▼
交换前后缓冲区
```

CPU 球体筛选用物体中心投影到相机前、右、上三个方向，并以估算半径扩张视锥边界。它会保守地保留与视锥相交的对象，不负责裁剪三角形。顶点着色器把顶点变换到裁剪空间后，光栅化阶段仍执行 GPU 图元裁剪。两者是不同阶段。

这 6 个物体都使用同一个立方体网格、shader 和不透明渲染状态；排序只按相机空间深度从近到远。每个对象仍单独更新模型矩阵和颜色 uniform，随后调用一次 `glDrawElements`。本例物体只有均匀缩放，因此顶点着色器可直接用模型矩阵的 3×3 部分变换法线；加入非均匀缩放时，需要使用逆转置法线矩阵。本例没有实现批处理；要把颜色不同的物体合并，需要把颜色等逐对象数据移入实例属性或缓冲区，并进一步确认网格、材质、纹理和渲染状态兼容。透明物体通常需要不同的排序与混合规则，本例不包含透明队列。

## 跟着代码走

示例代码在 [`src/main.cpp`](src/main.cpp)，构建配置在 [`CMakeLists.txt`](CMakeLists.txt)。

1. `processInput` 移动或转动相机；每帧只更新旋转角，不在窗口回调里直接绘制。
2. `collectVisibleObjects` 用球体边界做粗略视锥筛选，并记录相机空间深度。
3. `std::sort` 把不透明对象按深度从近到远排列。
4. `lookAt`、`perspective` 和 `makeModelMatrix` 分别生成 View、Projection 与对象 Model 矩阵。
5. 主循环先设置深度/面剔除/线框状态，再为每个对象设置 uniforms 并提交 EBO。

关闭 `F` 后把相机移到立方体群外，比较可见统计与 draw call 统计；关闭 `Z` 观察重叠面如何覆盖；关闭 `C` 从立方体内部或背面观察；试着把 opaque 深度排序改成反向，并解释为什么深度测试开启时外观可能保持不变，但过度绘制和状态排序目标会不同。

## 对照 Cocos 源码

- **Creator 2.4.15 Sprite 路径：** [`docs/2.x/06-graphics-rendering.md`](../../docs/2.x/06-graphics-rendering.md) 追踪 `Director.mainLoop → RenderFlow → Sprite assembler → ModelBatcher → ForwardRenderer → BaseRenderer._draw`。ModelBatcher 可合并兼容的 2D 数据；ForwardRenderer 再按相机建立 View 并处理 opaque/transparent 项。这个源码切片和本例的 3D 立方体不是同一对象类型。
- **Creator 3.8.7：** [`docs/3.x/06-graphics-rendering.md`](../../docs/3.x/06-graphics-rendering.md) 记录当前 Builtin Web 3D 路径中的 Root、RenderScene、Camera、pipeline、RenderGraph 与 GFX CommandBuffer；同一份研究也把 [`batcher-2d.ts`](../../engine/3.8.7engine/cocos/2d/renderer/batcher-2d.ts) 限定为独立的 2D 汇入路径。`Batcher2D.commitComp`/`autoMergeBatches` 按渲染数据、材质、纹理/采样器、层级和状态检查是否合批，不等同于本例的逐 MeshRenderer 绘制。
- **Cocos2d-x 4.0：** 本地源码 [`RenderPipelineGL.cpp`](../../engine/cocos2d-x-4/cocos/renderer/backend/opengl/RenderPipelineGL.cpp) 的 `RenderPipelineGL::update` 持有 `ProgramGL` 并更新混合状态；它是渲染管线状态应用的一层，不是整帧调度入口。结合 [`CCRenderer.cpp`](../../engine/cocos2d-x-4/cocos/renderer/CCRenderer.cpp) 与 [`CommandBufferGL.cpp`](../../engine/cocos2d-x-4/cocos/renderer/backend/opengl/CommandBufferGL.cpp) 追踪上层收集到后端命令的关系。版本证据和比较边界见[跨引擎研究计划](../../docs/cocos2d-x-creator2x-source-study-plan.md)。
- **跨版本地图：** [`docs/comparisons/06-graphics-rendering.md`](../../docs/comparisons/06-graphics-rendering.md) 对照 2.4.15 Sprite 与 3.8.7 MeshRenderer 的对象所有权和相机提交，明确两条轨迹来自不同对象和不同渲染路径，不能用于性能排名。

以上引擎部分是仓库源码与专题文档的静态追踪；本课没有重新运行 Creator 或 Cocos2d-x 项目。本例仅验证桌面 OpenGL 3.3 的简化不透明前向路径，不能证明 Creator 的 Web、Native 或自定义 pipeline 的运行行为。
