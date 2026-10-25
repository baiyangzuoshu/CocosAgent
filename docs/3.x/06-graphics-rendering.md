# 3.8.7 图形渲染

本篇以 [3.8 图形渲染](https://docs.cocos.com/creator/3.8/manual/zh/module-map/graphics.html)、[MeshRenderer](https://docs.cocos.com/creator/3.8/manual/zh/engine/renderable/model-component.html)、[Camera](https://docs.cocos.com/creator/3.8/manual/zh/editor/components/camera-component.html)、[材质脚本](https://docs.cocos.com/creator/3.8/manual/zh/material-system/material-script.html)、[材质结构](https://docs.cocos.com/creator/3.8/manual/zh/material-system/material-structure.html)和[自定义渲染管线](https://docs.cocos.com/creator/3.8/manual/zh/render-pipeline/write-render-pipeline.html)为公开行为基线。源码快照为 `engine/3.8.7engine`；运行观察来自 Creator 3.8.7 的 `3.8,7NewProject` 桌面 Web 预览。

## 场景与模块边界

`main.scene` 有 Main Camera 与 DirectionalLight；`islands.prefab` 有 10 个 MeshRenderer，其他预制体含 SkinnedMeshRenderer。网格资源按子网格与材质槽关联。该示例当前 Web 预览的 `macro.CUSTOM_PIPELINE_NAME` 为 `Builtin`，实际 pipeline 类为 `WebPipeline`，builder 为 `BuiltinPipelineBuilder`。仓库中的 builder 源码位于 `editor/assets/default_renderpipeline/builtin-pipeline.ts`：这是引擎仓库提供给编辑器使用的默认管线脚本，不等于编辑器本体源码。自定义管线可替换 builder，不能把下述 Builtin 分支当作所有 3.8 项目的固定流程。

| 层 | 主要职责与源码 |
| --- | --- |
| 组件与渲染资源 | `cocos/3d/framework/mesh-renderer.ts` 将 Mesh 和材料建成 Model/SubModel；`cocos/misc/renderer.ts` 管理 shared material 与按组件生成的 MaterialInstance。 |
| 场景状态 | `cocos/render-scene/core/render-scene.ts::RenderScene.update` 更新主光、局部光、Model 变换与 UBO；Camera、Light、Model 是渲染场景对象。 |
| 帧入口与 2D 汇入 | `cocos/game/director.ts::tick` 进入 `cocos/root.ts::Root.frameMove`；Root 更新/上传 `Batcher2D`，收集相机并调用 pipeline。2D UI Sprite 有自己的 `cocos/2d/renderer/batcher-2d.ts` 路径。 |
| 管线图构建 | `Director.buildRenderPipeline` 调用注册的 builder；Builtin builder 按相机配置构造简单或完整管线及 Pass/Queue。 |
| 裁剪、录制与提交 | `cocos/rendering/custom/{web-pipeline,scene-culling,executor,web-pipeline-types}.ts` 构建 RenderGraph、做可见性和光照收集、录入命令；Custom RenderQueue 最终经 GFX command buffer 提交 `draw`，Executor 再提交设备队列。 |

## 当前 3D 示例的一帧

```text
Director.tick → Root.frameMove
  → 收集 RenderWindow 的 Camera，Batcher2D.update/uploadBuffers
  → RenderScene.update(stamp): Light / Model transform / UBO
  → 相机按 priority 排序 → WebPipeline.render(cameraList)
  → beginFrame → Director.buildRenderPipeline
  → BuiltinPipelineBuilder.setup → 当前相机的 full forward passes
  → WebPipeline.execute → SceneCulling.buildRenderQueues
  → RenderQueue.recordCommands → GFX CommandBuffer.draw
  → Device.queue.submit → Root 调用 Device.present
```

`MeshRenderer._updateModels` 创建并配置 Model；`_attachToScene` 将其加入 RenderScene。移动节点后，`RenderScene.update` 在帧内更新对应 Model 的世界边界和 UBO。`MeshRenderer._onMaterialModified` 则更新材质定义与 SubModel 的 Pass。之后是否真正绘制，仍取决于 Camera visibility、视锥裁剪、Pass/Queue、透明度和管线配置。`Root._frameMoveEnd` 将 Camera 按 priority 排序，交给 pipeline；WebPipeline 每帧通过 `Director.buildRenderPipeline` 重建图，Executor 在图上裁剪并录制命令，最后提交 GFX 队列。

本次预览相机 `visibility=1820327937`，包含 `Layers.Enum.DEFAULT=1073741824`；Builtin builder 的 `_cameraConfigs.enableFullPipeline=true`，因此 `setup` 为该相机选择 `_buildForwardPipeline`，不是 `_buildSimplePipeline`。此选择来自该 builder 对 DEFAULT 层的判断，不能理解为所有相机始终使用完整管线。光照/阴影 Pass 还受场景和管线配置控制；本篇只确认 DirectionalLight 更新入口及当前 builder 分支，没有逐 Pass 计时或光照数值验证。

### 3.8 的 2D 渲染源码边界

3.8 的 2D Sprite 位于 `cocos/2d/components/sprite.ts`，设置 SpriteFrame 会标记渲染数据更新，切换 Sprite 类型会刷新 assembler。`cocos/2d/framework/ui-renderer.ts::updateRenderer` 更新组件渲染数据；`cocos/2d/renderer/batcher-2d.ts::commitComp` 比较 RenderData、材质、SpriteFrame 纹理/采样器、层级和深度模板状态，必要时合并旧批次并为当前组件调用 `assembler.fillBuffers`。`Root._frameMoveProcess` 每帧对 Batcher2D `update/uploadBuffers`，然后 2D 批次进入当前渲染管线。现有 3D 示例没有 Sprite Canvas；这些是静态源码结论，具体 UI 绘制与适配留在阶段 7 验证。

## 材质所有权与运行探针

3.8 手册示例仍可见 `getMaterial`/`setMaterial`；本地 3.8.7 `cocos/misc/renderer.ts` 将前者标为自 3.7.3 弃用、后者标为自 3.8.1 弃用。对这份源码优先用 `getSharedMaterial`/`setSharedMaterial` 表达共享材质槽，用 `getMaterialInstance` 在需要本组件独立参数时显式取得实例。实例与共享资产的身份不能混淆，也不要直接修改共享材质以实现单对象颜色变化。

[完整转录](../agent-foundation/traces/3.8.7-graphics-rendering.jsonl)来自 `http://localhost:7457/` DevTools，所有更改都在页面内存中恢复。

- 基线：RenderScene 有 26 个 Model，1 个 Camera；示例 `islands` 第一个 MeshRenderer 的共享材质名为 `seafloor`，其第一个 SubModel 的首 Pass 与共享材质 Pass 是同一对象，没有 MaterialInstance；该时点场景 draw call 为 49。
- 临时把该节点位置 x 增加 1，立即观察 `hasChangedFlags=1`、Model 边界中心 x 尚为 0；下一次 `EVENT_AFTER_RENDER` 中边界中心 x 为 1，Model update stamp 增加，场景 draw call 仍为 49，然后恢复原位置。这验证了变换通过渲染场景更新，但不代表单个模型必然提交一次绘制。
- `setSharedMaterial(stone,0)` 后，SubModel 首 Pass 与 `stone.passes[0]` 同一对象，未生成 MaterialInstance；绘制结束仍为 49。恢复 `seafloor` 后，Pass 身份也恢复。另调用 `getMaterialInstance(0)` 会惰性生成独立实例，SubModel 转用实例的 Pass；再次设置原共享材质并清除实例后恢复共享 Pass。这里验证的是材质绑定身份和此帧场景统计，不推断不同材质的性能等价。

## 开发时的定位顺序

3D 模型不显示时，按 Mesh/子网格与材质槽、组件激活和 Model 是否附加到 RenderScene、Camera visibility/视锥、材质 Pass、管线 Queue 的顺序查。材质改动未生效时先分清 shared 与 instance，再查 `_onMaterialModified → setSubModelMaterial` 和 PSO 重建。场景 draw call 异常要连同 Camera 数量、渲染阶段、SkinnedMeshRenderer、阴影/后处理 Pass、实例化和材质状态一起记录。

此预览只覆盖 WebGL `WebPipeline` 的当前 Builtin 配置。`native/cocos` 的原生 GFX 后端、其他自定义 builder、2D UI 的具体合批规则和完整阴影链尚未运行验证；2D/UI 深入内容归阶段 7，原生路径归阶段 10。
