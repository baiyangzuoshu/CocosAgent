---
name: cocos2-script-timing-trace
description: Diagnose Cocos Creator 2.4.15 component onLoad/onEnable/start/update/lateUpdate order, executionOrder, and component timer callbacks from this workspace's 2.x source. Use for missing or out-of-order script callbacks in a 2.x project.
---

# Trace 2.4.15 component timing

Confirm the report concerns `2.4.15engine/` or a Creator 2.4 project. Record the callback, node, component class, frame, activation operation, `component.enabled`, and `node.activeInHierarchy`; separate editor scene execution from browser preview or a published build.

Check the matching 2.4 manual pages before internal tracing: [lifecycle](https://docs.cocos.com/creator/2.4/manual/zh/scripting/life-cycle-callbacks.html), [execution order](https://docs.cocos.com/creator/2.4/manual/zh/scripting/execution-order.html), and [timers](https://docs.cocos.com/creator/2.4/manual/zh/scripting/scheduler.html). The public class declaration uses `cc.Class({ extends: cc.Component, editor: { executionOrder } })`; the component is attached through its node.

1. For `onLoad/onEnable`, follow `cocos2d/core/node-activator.js::activateNode/activateComp`. Check whether the component is disabled: first `onLoad` can occur while `onEnable` does not. Decide whether compared components belong to the **same** activation batch.
2. For `start/update/lateUpdate`, follow `cocos2d/core/component-scheduler.js::{OneOffInvoker,ReusableInvoker,_onEnabled,_onDisabled,startPhase,lateUpdatePhase}`. Inspect `_executionOrder` and the negative, zero, positive queues. `executionOrder` does not control `onDisable/onDestroy`.
3. If a component was added inside an active frame, inspect `_deferredComps` and `_startForNewComps`: `onLoad/onEnable` can execute in the add operation, `start` at this frame's end, and first `update` next frame.
4. For `schedule`/`scheduleOnce`, follow `CCComponent.js::schedule` → `CCDirector.getScheduler` → `CCScheduler.js::CallbackTimer.update`. Separate these timers from component `update`. Check pause/resume in `_onEnabled/_onDisabled`, cancellation in `_onPreDestroy`, and `CallbackTimer`'s initial `_elapsed=-1` pass.
5. Locate the actual frame loop in `CCDirector.js::mainLoop`, including the `CC_EDITOR` branch when applicable. On a reproducible case, log callback name plus frame and compare with the current runtime rather than assuming the saved Chrome trace covers every platform.

Use [the 2.x source study](../../../2.x/03-scripts-and-scheduling.md) and [one measured preview sequence](../../traces/2.4.15-script-timing.jsonl) as anchors. Report the earliest unexpected transition, its source symbol, whether the conclusion is manual, source, or runtime evidence, and a focused correction or next probe. Do not infer animation, physics, input, or cross-platform ordering from this timing trace.
