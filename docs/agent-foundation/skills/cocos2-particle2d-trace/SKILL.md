---
name: cocos2-particle2d-trace
description: Trace Cocos Creator 2.4.15 2D ParticleSystem emission, simulation, rendering, and node cleanup in this workspace.
---

# Trace 2.4.15 2D particles

Use the [2.4 ParticleSystem manual](https://docs.cocos.com/creator/2.4/manual/zh/components/particle-system.html) and [API reference](https://docs.cocos.com/creator/2.4/api/zh/classes/ParticleSystem.html) for public behavior. Read the [2.4 source map](../../../2.x/08-animation-and-effects.md).

1. Confirm that the component is `cc.ParticleSystem` from `cocos2d/particle/`, not the separate 3D particle system. Record source plist, texture, `playOnLoad`, duration, emission rate, particle life and `autoRemoveOnFinish`.
2. Trace `CCParticleSystem.lateUpdate → particle-simulator.js::step`. `stopSystem` stops new emission while existing particles continue to update; `resetSystem` clears living particles and restarts the emitter.
3. Follow the simulator's empty-particle condition (`particles.length===0 && !active && !readyToPlay`) to `_finishedSimulation`. It calls `resetSystem → stopSystem → disableRender`, then `node.destroy()` if `autoRemoveOnFinish` is enabled. The entire node, including other components, is scheduled for destruction; actual removal is deferred. Even stopping with zero living particles can reach this path on a later valid `lateUpdate`. Record particle count, node render flag, visible output, `destroy` call and node validity over more than one frame; do not treat stopping emission as asset release.
4. The [temporary four-case probe](../../probes/stage8-particle2d-2.4.js) has a [Creator Web natural-frame trace](../../traces/2.4.15-stage8-particle2d-headless-web.jsonl) and synchronized [before](../../traces/2.4.15-stage8-particle2d-headless-web-before-stop.png)/[after](../../traces/2.4.15-stage8-particle2d-headless-web-after-100ms.png) screenshots. In this in-memory opaque-white setup, live particles remain visible after `stopSystem`; zero-particle and drained emitters with `autoRemoveOnFinish=true` call `node.destroy`, with default `isValid=true` and strict `isValid(node,true)=false` in that frame, then `onDestroy`. When auto removal is false, `_finishedSimulation` recurs on later frames because it resets `finished`. Treat this as Web preview evidence with adjacent source-build provenance unconfirmed. Test an imported particle asset and Native backend separately; do not infer their rendering or release from the temporary texture.
