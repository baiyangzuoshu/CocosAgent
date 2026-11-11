# 第 57 课：SceneCulling 与 opaque/transparent RenderQueue

**本课问题：** Creator 3.8 如何先按相机筛选 Model，再把 Pass 放入不同排序队列？

## 本版路径

RenderPipeline 对每台相机运行 SceneCulling：模型必须启用、通过 node layer 或 visFlags 可见性判断，并通过视锥检查。ForwardStage 再遍历 Model/SubModel 的 Pass；队列只接收 phase 和混合类型匹配的 Pass。不透明队列按 hash、深度前到后、Shader ID 排序；透明队列按模型 priority、hash、深度后到前、Shader ID 排序。

## 源码位置

- `engine/3.8.7engine/cocos/rendering/scene-culling.ts:183-212`：相机 visibility、视锥判断和 RenderObject 收集。
- `engine/3.8.7engine/cocos/rendering/forward/forward-stage.ts:133-160`：遍历 RenderObject 的 SubModel/Pass，填充并排序队列。
- `engine/3.8.7engine/cocos/rendering/render-queue.ts:36-45`：不透明与透明比较函数。
- `engine/3.8.7engine/cocos/rendering/render-queue.ts:90-115`：过滤 Pass 并排序 RenderQueue。
- 前置课：[第 56 课：CameraComponent 到 Root 渲染管线](../s56_camera_root/README.md)。

## 独立代码与简化

示例按 3.8 的 `RenderPipeline → SceneCulling → ForwardStage → RenderQueue` 分层。用位掩码和布尔视锥状态代替完整几何计算；不创建 GFX 设备，也不记录 GPU 命令。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 `http://127.0.0.1:8000/s57_scene_culling_queue/`，HUD、视锥外模型和禁用模型不会进入 Main 相机的队列；玻璃按远到近排序。
