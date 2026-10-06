---
name: cocos3-object-lifecycle-trace
description: Diagnose Cocos Creator 3.8.7 prefab instantiation and instance overrides, node parenting and activation, component attachment, and deferred destruction from this workspace's 3.x engine source. Use when a 3.x node or component fails to activate, a prefab scene instance differs from its asset, or destroy timing is unclear.
---

# Trace 3.8.7 scene objects

Confirm the target is `3.8.7engine/` or `3.8,7NewProject/`, then identify whether the object came from runtime `instantiate(prefab)` or from a serialized scene prefab instance. These paths share types but perform different work.

Check the relevant 3.8 manual behavior first: [node activity and parenting](https://docs.cocos.com/creator/3.8/manual/zh/scripting/basic-node-api.html), [prefab assets and instance overrides](https://docs.cocos.com/creator/3.8/manual/zh/asset/prefab.html), [creation and destruction](https://docs.cocos.com/creator/3.8/manual/zh/scripting/create-destroy.html), or [lifecycle callbacks](https://docs.cocos.com/creator/3.8/manual/zh/scripting/life-cycle-callbacks.html). The measured preview trace uses an in-memory prefab; it does not validate the editor's save/revert/update workflow.

1. For runtime cloning, follow `cocos/serialization/instantiate.ts` → `scene-graph/prefab/prefab.ts` → `scene-graph/node.ts::_instantiate`. Check `Prefab.data`, whether the returned root has a parent, and `activeInHierarchy` before looking for component callbacks.
2. For a scene prefab instance, inspect `scene-graph/scene.ts::_load` and `scene-graph/prefab/utils.ts` together with `PrefabInfo` and `PrefabInstance` in `prefab-info.ts`. Resolve asset UUID, fileId, mounted nodes/components, removed components, and property/target overrides. Do not infer the expanded node tree by counting only `cc.Node` records in the scene JSON.
3. For a missing component callback, check `node.parent`, ancestor activity, `node.activeInHierarchy`, and `component.enabled`; then trace `Node.addComponent` or `Node.setParent` → `Node._onHierarchyChanged` → `NodeActivator.activateNode/activateComp`. A component on a detached active node has not entered the active scene. `Scene.addComponent()` is rejected; attach to a child node.
4. For reparenting, inspect `Node.setParent(value, keepWorldTransform)` and its event/scene/transform updates. `removeFromParent()` takes no cleanup argument in 3.8. For destruction, follow `Node.destroy` → `CCObject._deferredDestroy` → `Node._onPreDestroyBase` → `Component._onPreDestroy`. Distinguish immediate `onDisable` from deferred `onDestroy`; use `isValid(obj, true)` to detect a pending destroy in the current frame.
5. For a node that should survive a scene switch, check the [3.8 scene-loading manual](https://docs.cocos.com/creator/3.8/manual/zh/scripting/scene-managing.html), then inspect `director.addPersistRootNode` and `Director.runSceneImmediate`; verify direct scene parentage and `_originalSceneId`. The `game` method is a compatibility delegate. Prefab's `Persistent` inspector option is reserved and is not this API. Treat this path as source-traced until the target project reproduces the switch.

Use [the 3.x object study](../../../3.x/02-objects-and-scenes.md) for source anchors and [the measured preview trace](../../traces/3.8.7-object-scene.jsonl) for one concrete sequence. The trace uses an in-memory prefab in editor browser preview; the example's serialized prefab instances provide structural evidence, not a complete editor save workflow.

Report the operation, expected and observed states, the earliest failing transition, and exact source symbols. If the request concerns per-frame scheduling, asset ownership, or native bridges, continue into the appropriate modules before asserting behavior.
