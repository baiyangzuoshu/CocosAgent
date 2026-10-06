---
name: cocos2-particle3d-trace
description: Trace Cocos Creator 2.4.15 ParticleSystem3D playback, emission, simulation, and clearing in this workspace.
---

# Trace 2.4.15 3D particles

Use the [2.4 3D particle manual](https://docs.cocos.com/creator/2.4/manual/zh/3d/particle-system-3d.html) and [ParticleSystem3D API](https://docs.cocos.com/creator/2.4/api/zh/classes/ParticleSystem3D.html) for public behavior. Read the [2.4 source map](../../../2.x/08-animation-and-effects.md).

1. Confirm `cc.ParticleSystem3D` in `cocos2d/core/3d/particle/particle-system-3d.ts`, not the 2D `cc.ParticleSystem`. Record `playOnAwake`, duration, loop, simulation speed, material and enabled state.
2. Trace `play/pause/stop`, then component `update → _emit → _assembler._updateParticles → updateParticleBuffer`. A non-looping system past `duration + startDelay` sets `_isEmitting=false`, updates living particles until count zero, then calls `stop`. Manual `stop` calls `clear` when playing or paused; actual clearing requires `enabledInHierarchy`. It resets timing, but does **not** clear `_isEmitting`; after stopping during emission, `isStopped` and `isEmitting` can both be true. Check `isPlaying/isStopped/isEmitting` together. This snapshot has no public `stopEmitting` method matching 3.8.
3. Check assembler and trail module `onEnable/onDisable/onDestroy` when diagnosing invisible or lingering effects. Record particle count and rendered frames separately from playing/emitting flags.
4. Do not apply 2D `autoRemoveOnFinish` to this 3D component. Use the [temporary state probe](../../probes/stage8-particle3d-2.4.js) for direct-update checks and the [natural-frame probe](../../probes/stage8-particle3d-natural-2.4.js) for Director scheduling. The [direct-update trace](../../traces/2.4.15-stage8-particle3d-web.jsonl) and [natural-frame trace](../../traces/2.4.15-stage8-particle3d-natural-headless-web.jsonl) show stop and drain under their separate clocks. In this snapshot `getParticleCount()` reports allocated pool length (16 or 64 in these experiments), so use `_assembler._particles.length` when checking active particles; this internal field is diagnostic, not a public API. The natural-frame [active screenshot](../../traces/2.4.15-stage8-particle3d-natural-headless-web-active.png) shows no visible particles despite active count; investigate camera, material, and render submission before claiming visible behavior. The [validation record](../animation-effects-validation.md) tracks this boundary.
