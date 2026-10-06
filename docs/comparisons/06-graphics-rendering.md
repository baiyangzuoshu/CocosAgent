# 同一渲染行为：2.4.15 与 3.8.7

先读[2.x 独立研究](../2.x/06-graphics-rendering.md)和[3.x 独立研究](../3.x/06-graphics-rendering.md)。两份研究分别以对应系列的[2.4 图像和渲染手册](https://docs.cocos.com/creator/2.4/manual/zh/render/)与[3.8 图形渲染手册](https://docs.cocos.com/creator/3.8/manual/zh/module-map/graphics.html)为主纲。比较的开发者行为是“显示一个带材质的对象，移动或更换材质，然后让当前相机绘制”。两个示例对象不同：2.4 是 Sprite，3.8 是 MeshRenderer，因此只对照步骤与所有权，不能把内部对象逐类一一对应。

| 开发行为 | 2.4.15 Hello World Sprite | 3.8.7 3D MeshRenderer |
| --- | --- | --- |
| 画什么 | Node 上的 Sprite 持有 SpriteFrame，当前 Simple 模式由 assembler 产生 2D 顶点。2.4 另有 MeshRenderer，但此示例未运行。 | MeshRenderer 持有 Mesh；网格子网格对应材质槽，组件创建 Model/SubModel 并加入 RenderScene。3.8 另有 2D Batcher2D。 |
| 移动后何处更新 | Node `_renderFlag` 标记变换，下一次 `RenderFlow` 遍历消耗；batcher/相机随后提交。 | Node `hasChangedFlags` 标记变换，下一次 `RenderScene.update` 使 Model 边界和 UBO 更新；随后进入管线裁剪。 |
| 更换材质 | `CCRenderComponent.setMaterial(index,material)` 生成组件归属的 `MaterialVariant`，Sprite 绑定贴图；材质 hash 可触发 batcher flush。 | `setSharedMaterial(material,index)` 改共享材质槽与 SubModel Pass；`getMaterialInstance` 可惰性生成本组件的独立材质实例。 |
| 相机与绘制 | `ForwardRenderer` 提取 Camera View、处理 Light/对象排序；`BaseRenderer._draw` 逐 Pass 设置底层状态并调用 `device.draw`。 | Root 收集 Camera、更新 RenderScene；本示例使用 Builtin builder 的完整 forward 分支，RenderGraph 裁剪并录制 GFX CommandBuffer 后提交队列。 |
| 此次预览观察 | Sprite 移动后 flag 136→128，该帧场景 3 draw；换灰度材质后的场景 4 draw，恢复后 3。 | 模型移动后边界中心 x 0→1，该帧场景仍为 49 draw；更换共享材质时 SubModel Pass 身份同步变化，场景仍为 49 draw。 |

## 对架构与调试的含义

两版都先更新场景对象，再由相机选择并提交绘制；但 2.4 当前 2D 路径以 `RenderFlow` flag、assembler 和 ModelBatcher 为主，3.8 当前 3D 路径以 `RenderScene` 的 Model、材质 Pass、RenderGraph 和 GFX CommandBuffer 为主。2.4 也能绘制 3D，3.8 也能绘制 2D；这里只陈述两个**现有示例**实际跑过的分支。

同一“材质”词在两版有不同的组件所有权语义。2.4 `setMaterial` 在该组件上建立 `MaterialVariant`；3.8.7 要显式区分共享材质与实例，`getMaterialInstance` 会惰性创建独立对象，可能改变合批条件。对开发者而言，修改单个对象外观时需要先查当前版本的公开材质 API，再量测当前场景是否改变 Pass、batch 和 draw call。只看 draw call 总数无法确认某一对象是否被绘制，也无法把材质本身的 GPU 成本相加。

3.8 手册材质脚本页仍用 `getMaterial`/`setMaterial` 作示例；本地 3.8.7 源码已对这两个名字加弃用标记。它们是可用兼容入口，写新代码或 agent 建议时应优先表达 `getSharedMaterial`/`setSharedMaterial` 与 `getMaterialInstance` 的不同意图。2.4 不套用 3.8 的 shared/instance 名称。

## 证据与边界

两版的[运行验证记录](../agent-foundation/skills/graphics-rendering-validation.md)及[2.4 轨迹](../agent-foundation/traces/2.4.15-graphics-rendering.jsonl)、[3.8 轨迹](../agent-foundation/traces/3.8.7-graphics-rendering.jsonl)限定于本机桌面 Web 编辑器预览。示例场景、相机数、材质和批次均不同，所以 3 与 49 不能作为版本性能比较。尚未逐 Pass 验证阴影/后处理、2.4 3D 或 3.8 2D 细节；Native 与自定义管线也不能从当前 Web 结果推断。
