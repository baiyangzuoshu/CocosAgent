# 2.4.15 图形渲染

本篇以 [2.4 图像和渲染](https://docs.cocos.com/creator/2.4/manual/zh/render/)、[Sprite](https://docs.cocos.com/creator/2.4/manual/zh/components/sprite.html)、[Camera](https://docs.cocos.com/creator/2.4/manual/zh/render/camera.html)、[材质](https://docs.cocos.com/creator/2.4/manual/zh/render/material.html)、[Effect](https://docs.cocos.com/creator/2.4/manual/zh/render/effect.html)和 [Mesh Renderer](https://docs.cocos.com/creator/2.4/manual/zh/3d/mesh-renderer.html)为公开行为基线。源码快照是 `2.4.15engine`，运行观察来自 Creator 2.4.15 打开的 `2.4.15NewProject` 桌面 Web 预览。

## 范围与对象

Hello World 场景的 `Main Camera` 绘制 `background`、`cocos` Sprite 和 Label。Sprite 的 `SpriteFrame` 提供贴图与裁剪数据；材质指定 Effect、Technique/Pass 和渲染状态。2.4 也提供 3D `MeshRenderer`，但这个示例没有 3D 网格和光源，因此下文运行轨迹只验证 2D Sprite；3D 入口仅按源码和手册建立地图。

| 层 | 主要职责与源码 |
| --- | --- |
| 场景渲染组件 | `cocos2d/core/components/CCSprite.js`、`CCLabel.js`、`CCRenderComponent.js`；管理 SpriteFrame、材质及脏状态。 |
| 节点遍历与几何 | `cocos2d/core/renderer/render-flow.js::RenderFlow` 按 `_renderFlag` 访问节点；`cocos2d/core/renderer/webgl/assemblers/sprite/2d/simple.js` 为当前 Simple Sprite 填顶点。 |
| 批次转模型 | `cocos2d/core/renderer/webgl/model-batcher.js` 收集顶点、材质和纹理状态，`_flush` 建立带 InputAssembler/Effect 的 Model。 |
| 相机和绘制 | `cocos2d/renderer/renderers/forward-renderer.js` 从 Camera 提取 View，更新光照、排序 opaque/transparent 项；`cocos2d/renderer/core/base-renderer.js::_draw` 按 Pass 设置 GFX 状态并调用 `device.draw`。 |
| 3D 扩展 | `cocos2d/core/mesh/CCMeshRenderer.js`、`cocos2d/core/mesh/mesh-renderer.js`、`cocos2d/core/3d/CCLightComponent.js` 和渲染场景的 Camera/Light；不由本示例运行轨迹覆盖。 |

## 从 Sprite 到 WebGL 绘制

```text
CCDirector.mainLoop
  → renderer.render(Scene, dt)
  → RenderFlow.render / visitRootNode
  → Sprite assembler 更新数据并 fillBuffers
  → ModelBatcher 检查材质/纹理批次，_flush 建 Model + InputAssembler + Effect
  → ForwardRenderer 提取 Camera View、筛选并排序渲染项
  → BaseRenderer._draw 按 Effect 的 Pass 设 program/uniform/状态
  → gfx Device.draw → WebGL
```

`RenderFlow` 将节点的世界变换、渲染数据与子节点遍历拆成 flag 分支。Sprite 的 Simple 模式对应 `SimpleSpriteAssembler`；Sliced、Tiled、Filled 和 Mesh 模式各有不同 assembler，不能用这条顶点更新路径解释全部 Sprite。`RenderFlow.render` 每帧重置批处理器，访问当前 Scene，结束批次后交给 ForwardRenderer。后者按相机 View 渲染；Camera 的 depth、cullingMask、targetTexture 等公开设置会改变视图顺序、可见对象或目标，不等于修改 Sprite 本身。

材质路径有两层：`CCRenderComponent.setMaterial(index, material)` 将输入包装为归属当前组件的 `MaterialVariant`，随后 `_updateMaterial()`、`markForRender(true)`；`CCSprite._updateMaterial` 还将 SpriteFrame 纹理写入材质。`CCRenderComponent._checkBacth` 比较材质 hash 与 culling mask，不同则要求 batcher flush。最终一个 Draw 可能对应多个兼容的 2D 渲染组件；一个组件也可能因为多个 Pass 产生不止一次底层调用。因此单帧 draw call 不能直接当作单个 Sprite 的成本。

### 2.4 的 3D 与光照源码边界

2.4 的 [Mesh Renderer 手册](https://docs.cocos.com/creator/2.4/manual/zh/3d/mesh-renderer.html)规定网格子网格与材质槽的关系。`CCMeshRenderer.onEnable` 等待未加载 Mesh 的 native 数据，`_setMesh` 建包围盒并同步顶点属性，`_updateMaterial` 根据接收/投射阴影和网格顶点属性设置材质宏。`CCLightComponent.onEnable/onDisable` 将底层 Light 加入或移出渲染场景；`ForwardRenderer._updateLights` 更新光源、为有阴影的光源建立 shadowcast View，并更新光照宏。这说明 2.4 并非只有 Sprite/Label 路径。这里没有运行 3D 场景，不能断言特定灯光、阴影 Pass 或材质宏在实际项目中产生的 draw call 数。

## 真实预览中的两次短探针

[完整转录](../agent-foundation/traces/2.4.15-graphics-rendering.jsonl)来自 `http://localhost:7456/` 的 DevTools 临时脚本，未修改场景或引擎文件。

1. 基线 `cocos` Sprite 使用 `SimpleSpriteAssembler`、`builtin-2d-sprite (Instance)`，节点 `_renderFlag=128`、`_vertsDirty=false`，场景 `cc.renderer.drawCalls=3`。临时将该节点 `x` 改为 20，立即观察 `_renderFlag=136`；下一次 `EVENT_AFTER_DRAW` 中包装的底层 `device.draw` 计数为 3，flag 恢复 128。随后恢复 `x=0`。这验证了变换进入 RenderFlow 下一帧并被消耗，不能把数值 136/128 当成公开 API 或恒定枚举值。
2. 临时调用 `sprite.setMaterial(0, grayVariant)` 后，当前材质变为 `builtin-2d-gray-sprite (Instance)`，SpriteFrame 纹理属性仍存在，flag 为 144。下一次绘制结束场景 draw call 为 4；恢复原材质后为 3。只说明此场景、此灰度 Effect 与当时批次条件下额外产生了一次绘制提交，不表示任意材质切换都会增加一次。

## 开发时的定位顺序

Sprite 未显示时先核对 Node 激活、Camera 可见范围与 cullingMask、SpriteFrame 是否加载、Sprite 模式及材质/Pass；然后沿 `RenderFlow` 的 flag、assembler 的几何数据、batcher flush 和 ForwardRenderer 的相机 View 查。颜色或贴图异常先看 SpriteFrame 纹理是否绑定到当前 `MaterialVariant`，再看 Effect property 和 Pass；批次变化则同时记录相邻组件、材质 hash、纹理、混合/深度状态、Camera 和帧级 draw call。

本地代码能解释运行时渲染链，不能替代未提供的 Creator 编辑器本体的材质导入与 shader 编译细节。Web 探针没有覆盖 2.4 的 MeshRenderer、复杂光照、原生 GFX 或不同 Sprite 模式；这些是后续专题或平台验证任务。
