---
name: cocos3-input-event-trace
description: Trace Cocos Creator 3.8 global input, 2D UI pointer callbacks, coordinate spaces, and event propagation in this workspace's 3.8.7 source.
---

# Trace 3.8.7 input and event delivery

Confirm Creator 3.8. Use the [3.8 event](https://docs.cocos.com/creator/3.8/manual/zh/engine/event/event-emit.html), [input](https://docs.cocos.com/creator/3.8/manual/zh/engine/event/event-input.html), and [node event](https://docs.cocos.com/creator/3.8/manual/zh/engine/event/event-node.html) manual pages for public behavior. Follow the local [3.x study](../../../3.x/05-input-and-events.md) for the source map.

1. Classify the target: global hardware input uses `input.on(Input.EventType...)`; 2D UI callbacks use `node.on(Node.EventType...)`; custom event notification uses `emit` or a bubbling `Event` with `dispatchEvent`. Prefer `input` over deprecated `systemEvent` for new global-input code.
2. For a missing callback, trace the matching PAL (`web`, `native`, or mini-game) source → `Input._registerEvent`/`_emitEvent` → `PointerEventDispatcher` or global `InputEventDispatcher` → `NodeEventProcessor` → `UITransform.hitTest` → `Node.dispatchEvent` → component callback. Check the platform first: native touch messages are buffered and dispatched by `Director.tick`; Web does not share that exact timing.
3. For UI pointer misses, verify the node has `UITransform`, is active, is under the expected Canvas/camera/window, and inspect camera priority, sibling order, mask list, and hit rect. Node pointer dispatch is 2D UI hit testing; for 3D world objects use `input` coordinates and the relevant Camera raycast/PhysicsSystem path.
4. For overlap and propagation, separate the global `input` versus `systemEvent` compatibility bridge from the UI `PointerEventDispatcher` tier. A hit UI dispatcher stopped GLOBAL callbacks in the 3.8.7 Web probe even when `preventSwallow=true` let a lower sibling receive the start/down event. Without a UI hit, the compatibility bridge ran before a later registered direct `input` callback in this session; that order depends on registration. The bridge passes `(touch,event)` for touch, while direct `input` passes `(event)`. Then inspect touch claiming, per-event `preventSwallow`, capture/target/bubble phases, `Button`/`Toggle`/`BlockInputEvents`, and propagation flags.
5. Respect coordinate space: manual `EventTouch.getLocation()` is screen space and `getUILocation()` is UI space. Convert deliberately before raycasting or using a Node-local point. Do not infer Node coordinates from the browser DOM or reuse a screen point as local position.
6. Clean up global `input` listeners at the owning component's lifecycle boundary (`onDisable` or `onDestroy`, as intended). Node event processor ownership and a global input singleton have different cleanup behavior.
7. Report whether the result comes from the official manual, static TypeScript/PAL source, existing tests, Web runtime, native runtime, or a platform-specific build. If no event probe was run, state the code path as source evidence, not an observed click sequence.

The source trace is documented in [the 3.x note](../../../3.x/05-input-and-events.md); compare with 2.x after establishing this version's chain independently: [same-behavior comparison](../../../comparisons/05-input-and-events.md).

Web runtime evidence is in [the validation note](../input-event-validation.md), [the initial 3.8.7 trace](../../traces/3.8.7-input-events.jsonl), and [the completion trace](../../traces/3.8.7-input-events-completion.jsonl). Native and mini-game timing remains platform-specific work.
