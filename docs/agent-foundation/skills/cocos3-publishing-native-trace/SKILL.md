---
name: cocos3-publishing-native-trace
description: Trace a Cocos Creator 3.8.7 Web, mini game, or native publishing and startup issue through PAL selection, adapters, generated application, and C++ host evidence in this workspace.
---

# Trace 3.8.7 publishing and native startup

Use for a 3.8.7 project that differs by build target or fails during startup. This candidate skill has a [Mac package timing trace](../../traces/3.8.7-stage10-mac-native-startup.jsonl); other release targets need their own evidence. See the [3.8 source map](../../../3.x/10-publishing-and-native.md) and [validation state](../publishing-native-validation.md) before claiming runtime parity.

1. Record Creator version, target, preview or published run, build options, startup scene, backend and custom-engine path. Open the corresponding [build options](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/build-options.html), [Web](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-web.html), [native](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/native-options.html), or [mini game](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-mini-game.html) page.
2. Check project source/configuration, then label generated `build/` files as the particular build's evidence. Confirm which engine was bundled.
3. Inspect `cc.config.json` overrides for the target's `HTML5/NATIVE/MINIGAME/RUNTIME_BASED` build constant before following `cocos/core/platform/sys.ts` to the selected `pal/system-info` implementation. For Canvas/script loading follow the selected `pal/env`; for frame pacing follow `pal/pacer`. Record build constants, `sys.platform`, `isNative`, `isBrowser` and `hasFeature`, not just DOM-like globals. In this snapshot Minigame PAL sets both identity booleans false and uses a target-specific script loader; verify in that host before reporting behavior.
4. For Mac native startup, trace `native/cocos/application/CocosApplication.cpp → BaseGame.cpp` and `platforms/native/builtin/index.js`; then inspect generated `main.js → application.js`, `engine-adapter.js`, `cc.game.init → game.run`. Use `cocos/game/game.ts` to place the base, infrastructure, subsystem and project delegates.
5. For frame or pause issues, follow `game.ts::initPacer/_updateCallback` into `pal/pacer/{web,native}`. In native also follow `Engine::tick → events::Tick → EventDispatcher::dispatchTickEvent → gameTick`; distinguish SplashScreen's first draw, the launch-scene loading tick and the first draw after `EVENT_AFTER_SCENE_LAUNCH`.
6. Diagnose JSB-only object behavior with the [official pure JS/bound object note](https://docs.cocos.com/creator/3.8/manual/zh/advanced-topics/jsb-web-difference.html). Follow the relevant binding before inferring ownership. Mini game requires its actual adapter and host; Mac results cannot validate it.
7. Run a minimal target-specific probe and retain timestamped events, generated-file paths, config and version. State exactly which links were observed and which remain source deductions or outside this repository.
