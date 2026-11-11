# 第 57 课：Camera cullingMask 与绘制阶段

**本课问题：** Creator 2.4 如何按 View 的可见层筛模型，再按 opaque/transparent 阶段处理绘制项？

## 本版路径

2.4 的 BaseRenderer 在每个 View 中筛掉 `(model._cullingMask & view._cullingMask) === 0` 的模型，再按相机配置的 stage 收集对应 Effect Pass。ForwardRenderer 的透明阶段根据相机方向计算 sortKey 并排序；不透明阶段沿收集顺序绘制。本版用 View/Model 掩码演示多相机各自得到不同集合。

## 源码位置

- `engine/2.4.15engine/cocos2d/core/camera/CCCamera.js:525-529`、`:569-579`：Camera 同步 cullingMask 和渲染阶段。
- `engine/2.4.15engine/cocos2d/renderer/core/base-renderer.js:157-233`：按 View 筛模型，再按 stages 收集 DrawItem。
- `engine/2.4.15engine/cocos2d/renderer/renderers/forward-renderer.js:29-31`：相机 View 按 priority 排序。
- `engine/2.4.15engine/cocos2d/renderer/renderers/forward-renderer.js:308-334`：透明阶段计算深度排序并绘制。
- 前置课：[第 56 课：Camera 配置转成渲染 View](../s56_camera_view/README.md)。

## 独立代码与简化

独立示例保留 `CameraComponent → RendererCamera/View → BaseRenderer → ForwardRenderer`；用位掩码模拟可见层，`cameraDepth` 代替真实 view-space 深度。不会创建 WebGL 上下文，也不调用 GPU。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000/s57_camera_culling_queue/`，Main 只看到场景模型，Overlay 只看到 HUD；透明模型按远到近输出。
