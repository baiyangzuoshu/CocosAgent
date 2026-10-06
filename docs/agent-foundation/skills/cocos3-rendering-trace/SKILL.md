---
name: cocos3-rendering-trace
description: Trace Cocos Creator 3.8.7 MeshRenderer visibility, material ownership, render pipeline selection, and GFX draw submission in this workspace's 3.x source.
---

# Trace a 3.8.7 render result

Confirm the project uses Creator 3.8. Consult the [3.8 graphics manual](https://docs.cocos.com/creator/3.8/manual/zh/module-map/graphics.html) and the specific MeshRenderer, Camera, Material or pipeline page. Use the [3.x source map](../../../3.x/06-graphics-rendering.md).

1. Identify the renderer (MeshRenderer, SkinnedMeshRenderer or 2D UIRenderer), Camera, layer, platform, and actual pipeline name/builder. The existing 3D Web example uses `BuiltinPipelineBuilder` with `WebPipeline`; a project can select another builder or the legacy pipeline.
2. For an invisible 3D model, check active/enabled status, Mesh submeshes and material slots, attachment to `RenderScene`, Camera visibility and frustum, Pass/phase, light/shadow settings, then trace `Director.tick → Root.frameMove → RenderScene.update → pipeline.render → culling → queue.recordCommands → GFX command buffer`. Do not use the 2D Batcher2D path as an explanation for a MeshRenderer.
3. For a material change, distinguish `getSharedMaterial`/`setSharedMaterial` from `getMaterialInstance`. The latter creates a component-specific instance lazily; inspect `MeshRenderer._onMaterialModified → Model.setSubModelMaterial`, and verify which Pass identity the SubModel uses. This local 3.8.7 snapshot marks `getMaterial`/`setMaterial` deprecated although the 3.8 manual still shows them.
4. For frame or draw count changes, record Camera count, chosen pipeline branch, scene models, Pass and batching/instancing conditions. A scene-level `numDrawCalls` cannot prove one model generated a draw. A reversible one-frame probe may inspect Model bounds or SubModel Pass before restoring state.
5. State whether the conclusion comes from manual, TypeScript/C++ source, or a Web/native runtime probe. Current validation covers the Builtin full forward branch on desktop Web; custom pipelines, 2D UI, and native GFX need their own trace.

Use the [same-behavior comparison](../../../comparisons/06-graphics-rendering.md) after this version's chain is established. See the [validation note](../graphics-rendering-validation.md) for the Web probe and its limits.
