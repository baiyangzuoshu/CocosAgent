# 第 26 课：Shadow Mapping

方向光先从自己的视角绘制场景，把最近表面的深度写进 shadow map；主相机再绘制场景，并把每个片元的位置变换到光源空间，与贴图中的深度比较，决定是否落在阴影里。窗口右下角同时显示深度图，便于把两次绘制对应起来。

## 学完后你能

- 说明 shadow map 为什么需要一次光源视角的深度绘制和一次主相机绘制。
- 使用光源的 view-projection 矩阵把世界位置投影到 shadow map。
- 将裁剪空间坐标变换到 `[0, 1]` 纹理坐标，再比较当前深度与最近深度。
- 解释深度 bias 如何缓解 shadow acne，以及 bias 过大会造成什么现象。
- 识别阴影贴图分辨率、光源投影范围和硬边比较对阴影质量的影响。

## 运行

需要 CMake 3.20 或更新版本、C++17 编译器、OpenGL 开发库、GLFW 3，以及为 OpenGL 3.3 Core 生成的 GLAD 1。依赖由本机提供，课程不会自动下载或安装。

在本目录运行：

```sh
cmake -S . -B build
cmake --build build
./build/learn_opengl_s26_shadow_mapping
```

- `Space`：暂停或继续立方体旋转。
- `Left` / `Right`：转动方向光的水平角度。
- `Up` / `Down`：调整方向光仰角。
- `B`：开关阴影比较。
- `D`：显示或隐藏右下角的深度贴图预览。
- `-` / `=`：减小或增大深度 bias。
- `R`：恢复默认光源、角度、bias 和显示选项。
- `Esc`：关闭窗口。

场景包含接收阴影的地面和两个不同大小的立方体。标题显示阴影状态、深度图预览状态和 bias 数值。

## 两次绘制如何生成阴影

```text
方向光 view-projection
        │
        ├─ depth pass：绘制地面和立方体
        │                 只写最近深度 → 1024 × 1024 depth texture
        │
        └─ camera pass：绘制同一场景
                          世界位置 → 光源裁剪空间 → [0, 1] 纹理坐标
                          当前深度 vs. shadow map → 明亮 / 阴影
```

第一阶段绑定仅有深度附件的 framebuffer，清除深度并绘制场景几何体。深度 shader 不输出颜色；深度测试让贴图保留从光源看过去最靠近光源的表面。`GL_CLAMP_TO_BORDER` 配合深度值为 1 的边框，让光源投影范围以外的采样默认为无遮挡。

第二阶段切回窗口 framebuffer。顶点 shader 同时计算主相机裁剪位置和光源空间位置；片元 shader 对光源裁剪坐标做透视除法，再把 `[-1, 1]` 映射到 `[0, 1]`。如果当前片元的光源深度比贴图记录的最近深度更大，它被其他表面挡在后面，本例就降低它的漫反射亮度。`B` 可直接比较启用和关闭阴影时的同一场景。

深度精度、栅格化和表面自比较会造成 shadow acne。shader 用法线与光照方向估算斜率，并减去 bias；`-` / `=` 可调整 bias，观察太小的 bias 留下条纹、太大的 bias 让阴影与物体分离的现象。右下角预览显示 `1 - depth`，方便看出深度 pass 保存的近远关系；它不是最终阴影遮罩。

## 跟着代码走

示例代码在 [`src/main.cpp`](src/main.cpp)，构建配置在 [`CMakeLists.txt`](CMakeLists.txt)。

1. `createShadowTarget` 创建 1024 × 1024 深度纹理与深度 framebuffer，并检查完整性。
2. `lightViewProjection` 用方向光视点和正交投影生成光源矩阵。
3. depth pass 通过 `uLightViewProjection * uModel` 绘制地面与立方体，只写深度。
4. camera pass 把 `vLightSpacePosition` 做透视除法，采样 `uShadowMap` 并比较深度。
5. 深度预览 pass 把 shadow map 显示为灰度，主相机窗口可以调整大小但 shadow map 分辨率固定。

在 `uShadowBias` 处逐步减小 bias，观察表面条纹；再增加 bias，留意阴影边缘脱离物体的距离。把 `kShadowMapSize` 调低，观察阴影边缘像素化；扩大光源正交投影范围，则同一张贴图要覆盖更大世界区域，局部细节会减少。

## 检查理解

- 为什么 shadow map 必须先从光源视角绘制？
- 深度纹理里的值代表“离光源最近”的什么信息？
- 为什么主相机片元要先经过光源 view-projection 矩阵？
- `[-1, 1]` 到 `[0, 1]` 的坐标映射在采样时解决什么问题？
- shadow acne 和 peter-panning 分别如何受到 bias 影响？
- 为什么相同分辨率下，增大光源正交投影范围会降低局部阴影精度？

## 对照引擎源码

- Creator 2.4.15 [`forward-renderer.js`](../../engine/2.4.15engine/cocos2d/renderer/renderers/forward-renderer.js) 注册 `shadowcast` stage；`_updateLights` 让带阴影的光源提取 `shadowcast` view，`_shadowStage` 仅绘制带 `CC_CASTING_SHADOW` define 的项。后续 opaque stage 上传光源 view-projection 矩阵，并将 shadow map 绑定到材质采样器。这里可对应本课的光源 pass、阴影投射者筛选和主相机采样。
- Creator 3.8.7 的默认前向资源 [`builtin-forward.rpp`](../../engine/3.8.7engine/editor/assets/default_renderpipeline/builtin-forward.rpp) 先列出 `ShadowFlow`、再列出 `ForwardFlow`。[`shadow-flow.ts`](../../engine/3.8.7engine/cocos/rendering/shadow/shadow-flow.ts) 为主方向光及其级联、有效聚光灯建立 shadow framebuffer，并安排 shadow stage；当前源码的 shadow color target 选择 `R32F` 或 `RGBA8`，并另配深度模板附件，因此不应把它等同于本例直接采样的 depth texture。 [`shadow-stage.ts`](../../engine/3.8.7engine/cocos/rendering/shadow/shadow-stage.ts) 设置光源 UBO、收集阴影绘制项并提交 render pass；[`render-shadow-map-batched-queue.ts`](../../engine/3.8.7engine/cocos/rendering/render-shadow-map-batched-queue.ts) 根据灯光类型筛选物体和 shadow pass，并处理可实例化的批次。

本例只实现一个方向光、单张正交投影深度图、硬边深度比较和单次采样 bias；没有实现级联、PCF 软阴影、点光源立方体 shadow map、透明物体阴影、法线偏移、动态贴图尺寸或引擎级剔除/批处理。引擎对照限定于 Creator 2.4.15 的 WebGL renderer 与 Creator 3.8.7 仓库中的默认前向 ShadowFlow 路径。
