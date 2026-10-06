---
name: cocos2-object-lifecycle-trace
description: Diagnose Cocos Creator 2.4.15 prefab instantiation, node parenting and activation, component attachment, and deferred destruction from this workspace's 2.x engine source. Use when a 2.x node or component fails to activate, behaves unexpectedly after reparenting, or appears valid after destroy.
---

# Trace 2.4.15 scene objects

Confirm the target is `2.4.15engine/` or `2.4.15NewProject/`. Start with the developer operation and the observed callback or state; identify the first transition that differs from expectation.

Before tracing internals, match the report to the 2.4 manual: [node and component activity](https://docs.cocos.com/creator/2.4/manual/zh/scripting/basic-node-api.html), [prefab asset and instance editing](https://docs.cocos.com/creator/2.4/manual/zh/asset-workflow/prefab.html), [creation and destruction](https://docs.cocos.com/creator/2.4/manual/zh/scripting/create-destroy.html), or [lifecycle callbacks](https://docs.cocos.com/creator/2.4/manual/zh/scripting/life-cycle-callbacks.html). Identify whether the symptom concerns runtime cloning or an editor prefab instance; the in-memory preview trace verifies only the former.

1. For a prefab clone, follow `cocos2d/core/platform/instantiate.js` → `assets/CCPrefab.js` → `utils/base-node.js::_instantiate` → `CCNode.js::_onBatchCreated`. Inspect `Prefab.data` and `_prefab`/`PrefabInfo`; cloning alone does not attach the root to a scene.
2. For a missing component callback, check `node.parent`, every ancestor's `active`, `node.activeInHierarchy`, and `component.enabled`. Then follow `BaseNode.addComponent` or `BaseNode.setParent` → `BaseNode._onHierarchyChanged` → `node-activator.js::activateNode/activateComp` → `component-scheduler.js`. Avoid concluding that local `active=true` means scene activation.
3. For reparenting, inspect `BaseNode.setParent` and `CCNode._onHierarchyChanged`; account for parent/child lists, activity, events, and rendering flags. If using `removeFromParent`, pass `false` when events/actions must survive: in 2.4 omitting it defaults to cleanup. Editor prefab manual/auto sync is a separate workflow and defaults to manual. Do not recommend editing `_parent` or `_children` directly.
4. For destruction, follow `BaseNode.destroy` → `CCObject.destroy` → `CCObject._deferredDestroy` → `CCNode._onPreDestroy`/`BaseNode._onPreDestroyBase` → `Component._onPreDestroy`. Distinguish immediate `onDisable` from deferred `onDestroy`. Check `cc.isValid(obj, true)` when the question concerns a call to `destroy()` in the current frame.
5. For a node that should survive a scene switch, check the [2.4 scene-loading manual](https://docs.cocos.com/creator/2.4/manual/zh/scripting/scene-managing.html), inspect `cc.game.addPersistRootNode`, verify it is a direct scene child, then follow `CCDirector.runSceneImmediate` as it reattaches persistent roots. Treat this as a source-traced path until the target project reproduces the switch.

Use [the 2.x object study](../../../2.x/02-objects-and-scenes.md) for source anchors and [the measured preview trace](../../traces/2.4.15-object-scene.jsonl) for one concrete sequence. The trace uses an in-memory prefab in editor browser preview; it does not establish behavior for every platform or editor asset workflow.

Report the operation, expected and observed states, the earliest failing transition, and exact source symbols. If the request concerns per-frame `start/update/lateUpdate` ordering or serialized asset references, continue into those modules instead of extrapolating from this skill.
