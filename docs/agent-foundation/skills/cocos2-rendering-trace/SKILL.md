---
name: cocos2-rendering-trace
description: Trace Cocos Creator 2.4.15 Sprite or MeshRenderer visibility, material, batching, and draw submission in this workspace's 2.x source.
---

# Trace a 2.4.15 render result

Confirm the project uses Creator 2.4. Read the relevant [2.4 rendering manual](https://docs.cocos.com/creator/2.4/manual/zh/render/) page for Sprite, Camera, Material/Effect or MeshRenderer before interpreting internals. Use the [2.x source map](../../../2.x/06-graphics-rendering.md).

1. Identify the object and renderer type, camera and target platform. The existing Hello World runtime trace covers a Simple Sprite in desktop Web; for MeshRenderer, other Sprite modes or native rendering, follow the matching source path and gather fresh runtime evidence.
2. For an invisible or stale Sprite, inspect Node activity, SpriteFrame/texture readiness, Camera culling mask and target, material/Effect Pass, and the component's dirty state. Follow `CCDirector.mainLoop → RenderFlow.render → assembler → ModelBatcher._flush → ForwardRenderer → BaseRenderer._draw → device.draw`. Locate the exact assembler selected by the Sprite mode.
3. For material changes, inspect `CCRenderComponent.setMaterial` and the returned `MaterialVariant`, then `CCSprite._updateMaterial` and `_checkBacth`. Record material hash, texture, neighbor draw items, Camera and Pass before attributing a flush or draw count change. A scene draw call counter is not an object-level trace.
4. If behavior remains unclear, use a one-frame browser preview probe around a reversible node transform or material change; capture before state, next `EVENT_AFTER_DRAW`, then restore the original state. Avoid editing generated `library`/`build` files. For native behavior trace the native backend separately.
5. Report manual claim, source path/symbol, runtime version/platform, measured state and unresolved branch separately. Do not treat private flags or the example's 3→4 draw count as stable API or fixed performance cost.

Use the [same-behavior comparison](../../../comparisons/06-graphics-rendering.md) only after forming the 2.4 conclusion. The [validation note](../graphics-rendering-validation.md) records the limited Web probe.
