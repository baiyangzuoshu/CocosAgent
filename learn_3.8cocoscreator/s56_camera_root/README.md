# 第 56 课：CameraComponent 到 Root 渲染管线

**本课问题：** Creator 3.8 如何从 CameraComponent 建立 RenderScene 相机，并由 Root 收集后送入管线？

## 本版路径

3.8 的 CameraComponent 通过 `Root.createCamera()` 创建渲染层 Camera，初始化投影、目标 RenderWindow、优先级与视口，再把相机挂到 RenderScene。RenderWindow 在帧处理时提取启用的相机；Root 排序相机后调用 RenderPipeline，并在提交后 present。该路径保留 Root、RenderScene、RenderWindow 和 GFX CommandBuffer 的职责，不沿用 2.4 的 View 池结构。

## 源码位置

- `engine/3.8.7engine/cocos/misc/camera-component.ts:700-745`：创建渲染 Camera、同步属性并挂到 RenderScene。
- `engine/3.8.7engine/cocos/render-scene/scene/camera.ts:906-930`、`:1196-1209`：Camera 初始化并关联目标窗口。
- `engine/3.8.7engine/cocos/render-scene/core/render-scene.ts:263-267`：RenderScene 添加相机。
- `engine/3.8.7engine/cocos/render-scene/core/render-window.ts:287-300`：窗口提取启用相机并更新相机状态。
- `engine/3.8.7engine/cocos/root.ts:756-803`：Root 收集、按 priority 排序、渲染并 present。
- `engine/3.8.7engine/cocos/rendering/render-pipeline.ts:476-503`：管线逐相机执行 flow，并提交 CommandBuffer。
- 前置课：[第 13 课：SpriteFrame UV](../s13_sprite_frame_texture/README.md)。

## 独立代码与简化

代码按 3.8 的 `CameraComponent → Camera/RenderWindow/RenderScene → Root → RenderPipeline` 分层。两个相机展示窗口提取和优先级排序；示例只打印阶段，不创建 GFX 设备，也不代表 Creator 编辑器或目标运行时验收。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000/s56_camera_root/`，输出应显示 `Main` 先于 `Overlay` 进入管线。
