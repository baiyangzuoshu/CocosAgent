---
name: cocos3-script-timing-trace
description: Diagnose Cocos Creator 3.8.7 component onLoad/onEnable/start/update/lateUpdate order, @executionOrder, and component timer callbacks from this workspace's 3.x source. Use for missing or out-of-order script callbacks in a 3.x project.
---

# Trace 3.8.7 component timing

Confirm the report concerns `3.8.7engine/` or a Creator 3.8 project. Record the callback, node, component class, frame, activation operation, `component.enabled`, and `node.activeInHierarchy`; identify browser preview, editor scene, published Web, or native runtime.

Check the matching 3.8 manual pages first: [components and execution order](https://docs.cocos.com/creator/3.8/manual/zh/scripting/component.html), [lifecycle](https://docs.cocos.com/creator/3.8/manual/zh/scripting/life-cycle-callbacks.html), and [timers](https://docs.cocos.com/creator/3.8/manual/zh/scripting/scheduler.html). Project scripts use `@ccclass` and, when needed, `@executionOrder`; create components with `node.addComponent`, not by constructing them directly.

1. For `onLoad/onEnable`, follow `cocos/scene-graph/node-activator.ts::activateNode/activateComp`; distinguish first load from each enable and decide whether compared components share one activation batch.
2. For `start/update/lateUpdate`, follow `cocos/scene-graph/component-scheduler.ts::{OneOffInvoker,ReusableInvoker,_onEnabled,_onDisabled,startPhase,lateUpdatePhase}`. Read `_executionOrder` on the component class; `@executionOrder` affects five main callbacks, not `onDisable/onDestroy`. The `internal*` getters in `component.ts` are engine accessors, not project callback names.
3. For a component added inside `update`, inspect `_deferredComps` and `_startForNewComps`: `onLoad/onEnable` can happen immediately, `start` in the current frame's tail, and first `update` next frame.
4. For component timers, follow `component.ts::schedule` → `director.getScheduler()` → `core/scheduler.ts::CallbackTimer.update`. Check the target's pause/resume on enable/disable and cancellation on destroy. A zero-delay callback still passes through initial timer setup.
5. Follow `cocos/game/director.ts::tick` and `Director.init`: the generic Scheduler is a registered `System` with priority 200 between component update and late update. Inspect registration and priority before asserting its order relative to another System. Reproduce the reported case with frame-number logs in its actual platform.

Use [the 3.x source study](../../../3.x/03-scripts-and-scheduling.md) and [one measured preview sequence](../../traces/3.8.7-script-timing.jsonl) as anchors. Report the first divergent callback or state with exact source symbol and evidence type. Keep editor import/compilation, input, animation, physics, and native backends outside this skill's established runtime trace until separately verified.
