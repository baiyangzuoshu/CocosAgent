---
name: cocos2-publishing-native-trace
description: Trace a Cocos Creator 2.4.15 Web, mini game, or native publishing and startup issue through project output, platform macros, cc.sys, and JSB evidence in this workspace.
---

# Trace 2.4.15 publishing and native startup

Use for a 2.4.15 project that behaves differently in Web preview, published Web, mini game, or native. This candidate skill has a [Mac package timing trace](../../traces/2.4.15-stage10-mac-native-startup.jsonl); other release targets need their own evidence. Read the [2.4 source map](../../../2.x/10-publishing-and-native.md) and [validation state](../publishing-native-validation.md).

1. Record Creator version, exact target, preview or published run, build mode, launch scene, and custom-engine path. Open the matching [Web](https://docs.cocos.com/creator/2.4/manual/zh/publish/publish-web.html), [native](https://docs.cocos.com/creator/2.4/manual/zh/publish/publish-native.html), or [mini game](https://docs.cocos.com/creator/2.4/manual/zh/editor/publish/publish-wechatgame.html) manual before diagnosing.
2. Check project `assets/`, `.meta`, build configuration, and only then generated output. Label `build/` as a snapshot, not source. Confirm whether the output used the adjacent custom engine.
3. For platform identity, trace `predefine.js` and `gulp/util/utils.js::getMacros` to `cocos2d/core/platform/CCSys.js`. Record `CC_JSB`, `CC_RUNTIME`, `cc.sys.platform`, `isNative`, `isBrowser` and host-provided globals. Do not infer Web solely from `window`.
4. For Mac native startup, follow generated `frameworks/runtime-src/Classes/AppDelegate.cpp` → `jsb-builtin.js` → `main.js` → `jsb-engine.js` → `boot` → Bundle loading → `cc.game.run` → launch scene. Identify the first failing hop and retain its log or trace.
5. For frame or pause issues, follow `CCGame.js::_setAnimFrame/_runMainLoop → director.mainLoop`. In JSB inspect the generated adapter's `gameTick/requestAnimationFrame`; in Web inspect the rAF/timer branch. The Mac trace shows an `AFTER_DRAW` before launch scene and another after it: `EVENT_GAME_INITED` and an unqualified first draw do not prove the scene has rendered.
6. For mini games, first inspect the actual `__globalAdapter.adaptSys` result and target host. `CCSys.js` may delegate system values to that adapter; its generic initial `isBrowser` expression is insufficient. For other targets too, locate the generated entry and adapter rather than transplanting the Mac chain. Report missing editor-builder or platform-host sources.
7. Verify the claim in the actual target runtime with a minimal, reversible probe. Output manual page, source symbols, build-file path, runtime version/config, observed event order and unresolved uncertainty separately.
