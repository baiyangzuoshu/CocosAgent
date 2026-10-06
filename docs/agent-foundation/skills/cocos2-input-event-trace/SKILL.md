---
name: cocos2-input-event-trace
description: Trace Cocos Creator 2.4 node mouse/touch callbacks, global keyboard or motion input, hit testing, and event propagation in this workspace's 2.4.15 source.
---

# Trace 2.4.15 input and event delivery

Confirm Creator 2.4. Use the [2.4 event](https://docs.cocos.com/creator/2.4/manual/zh/scripting/events.html), [node system event](https://docs.cocos.com/creator/2.4/manual/zh/scripting/internal-events.html), and [global system event](https://docs.cocos.com/creator/2.4/manual/zh/scripting/player-controls.html) manual pages for public behavior. Follow the local [2.x study](../../../2.x/05-input-and-events.md) for the source map.

1. Classify the listener first: Node mouse/touch via `node.on`, keyboard/motion via `cc.systemEvent`, or a custom notification via `emit`/`dispatchEvent`. Do not recommend direct `cc.eventManager` use for game scripts; the 2.4 manual says it is not a stable public API.
2. For a missing Web pointer callback, trace `CCGame` input setup → `CCInputManager.registerSystemEvent` → DOM coordinate conversion and `handleTouches*` → `CCEventManager.dispatchEvent` → Node listener registration and priority → `CCNode._hitTest` → `dispatchEvent` → component callback. Keep browser Web input separate from JSB and mini-game paths.
3. For a hit-test failure, compare the event coordinate space with View design resolution, active Camera, Node world transform, anchor, content size, and any ancestor `Mask`. Record the exact target and whether its Node is active; inspect `_hitTest` before changing scene sizes.
4. For overlapping targets, separate candidate hit order/swallow from parent capture/bubbling. Follow scene-graph listener priority, one-by-one touch claim, `swallowTouches`, mask filtering, and `event.stopPropagation()`. The 2.4.15 probe changed internal `_touchListener.swallowTouches=false` and both siblings then received touch; do not recommend that internal field as a public game API. Mouse down reached both siblings even with default touch swallowing.
5. For custom events, distinguish `node.emit` (listeners on that Node only) from `node.dispatchEvent(new cc.Event.EventCustom(type, true))` (bubbling event object). In 2.4.15, `CCNode.on` uses `useCapture` only for built-in touch/mouse types; ordinary custom types registered with `useCapture=true` still run during bubbling. Do not copy the 3.8 custom capture behavior into 2.4. Verify `on/once/off/targetOff` parameters; unregister `cc.systemEvent` listeners when their owner no longer needs them.
6. State evidence type and runtime surface. If no actual input probe is available, report a source-derived path rather than claiming a tested click order. Do not generalize Web event ordering to native or mini-game runtimes.

The source trace is documented in [the 2.x note](../../../2.x/05-input-and-events.md); compare with the 3.x path only after establishing this 2.4 chain independently: [same-behavior comparison](../../../comparisons/05-input-and-events.md).

Web runtime evidence is in [the validation note](../input-event-validation.md), [the initial 2.4.15 trace](../../traces/2.4.15-input-events.jsonl), and [the completion trace](../../traces/2.4.15-input-events-completion.jsonl). Native and mini-game timing remains platform-specific work.
