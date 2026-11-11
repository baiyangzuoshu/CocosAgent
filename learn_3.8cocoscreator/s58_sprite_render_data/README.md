# 第 58 课：Sprite assembler 与 RenderData 刷新

**本课问题：** Creator 3.8 的 Sprite 如何选择 assembler、刷新脏顶点，再交给 Batcher2D？

## 本版路径

Sprite._flushAssembler 选择当前类型的组装器并创建 RenderData。属性变化时 UIRenderer._markForUpdateRenderData 设置 vertDirty，并把组件交给 uiRendererManager；updateAllDirtyRenderers 调用 updateRenderer，进而由 Simple assembler 更新 UV 和顶点。之后 Batcher2D.commitComp 调用 assembler.fillBuffers。本版不沿用 2.4 的 RenderFlow。

## 源码位置

- engine/3.8.7engine/cocos/2d/components/sprite.ts:207-215、597-615：Sprite 属性变化、选择 assembler 和创建 RenderData。
- engine/3.8.7engine/cocos/2d/framework/ui-renderer.ts:433-440、471-485：标记 vertDirty、调用 assembler 更新数据。
- engine/3.8.7engine/cocos/2d/framework/ui-renderer-manager.ts:58-75：收集脏 Renderer 并刷新。
- engine/3.8.7engine/cocos/2d/assembler/sprite/simple.ts:43-65、98-116：创建四顶点数据、计算位置和填充批次索引。
- engine/3.8.7engine/cocos/2d/renderer/render-data.ts:462-509：更新 RenderData 的材质、节点、纹理与哈希状态。
- engine/3.8.7engine/cocos/2d/renderer/batcher-2d.ts:429-484：commitComp 设置当前批次并调用 assembler.fillBuffers。
- 前置课：第 57 课：SceneCulling 与 RenderQueue（../s57_scene_culling_queue/README.md）。

## 独立代码与简化

示例使用 3.8 的 UIRendererManager → updateRenderer → Simple assembler → Batcher2D.commitComp 顺序。只输出 CPU 侧 RenderData 和四边形索引，不上传 GFX Buffer，也不执行 GPU draw。

## 运行

~~~sh
deno task check
deno task build
deno task serve
~~~

打开 http://127.0.0.1:8000/。页面会显示组件脏标记、RenderData 更新和 Batcher2D 收到的顶点/索引。
