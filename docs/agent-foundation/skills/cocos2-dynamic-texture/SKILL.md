---
name: cocos2-dynamic-texture
description: Diagnose repeated Texture2D loading, replacement, references, and release in Creator 2.4.15.
---

# Creator 2.4 dynamic texture

Use this skill when analyzing runtime texture replacement in 2.4.15. Read the [2.4 release manual](https://docs.cocos.com/creator/2.4/manual/zh/asset-manager/release-manager.html) and [measured first slice](../../dynamic-content-first-slice.md).

For a named local content version, inspect the [CocosAgent 0.1 release contract](../../content-release-0.1.md) first. `content.select` changes Host metadata; when the 2.4 runtime channel is connected, Host dispatches the selected release to the game. Resolve each declared PNG in the built-in `resources` bundle by its base name; check the exact Creator version, staged fingerprint and dependency declaration before runtime work. For repeated swap timing, reference/cache sampling and explicit P95 gates in a Web-Mobile build, use the [2.4 dynamic content performance skill](../../../cocos-creator-agent-cli/skills/cocos2-dynamic-content-performance/SKILL.md).

For the [measured Web runtime flow](../../content-runtime-web-0.1.md), the 2.4 example starts `CocosAgentContentRuntime` and `CocosAgentRuntimeChannel` from `HelloWorld.onLoad`; no test-source injection is required. After dispatch, wait for the runtime receipt and visible frame. Host accepts `applied`/`already-active` only when the receipt's release, fingerprint, asset UUID and positive reference count match the selected release. On `retained`, leave the previous SpriteFrame and `effective` release in place even though Host `selected` may still name the failed candidate. Call `content.rollback` to restore the pointer; after removing the cause, select the candidate again and wait for `applied` before treating it as effective.

1. Confirm the asset is in the intended bundle and read its 2.4 `.meta` UUID/type. For these imported PNGs, `cc.resources.load(name, cc.Texture2D)` resolves the main texture.
2. Load the next asset, call `addRef()` for the owner, then switch the owner reference. Only after the switch, call `decRef()` on the previous owned asset.
3. Observe `refCount`, `cc.assetManager.assets.has(uuid)`, validity and time after non-forced `releaseUnusedAssets()`. Do not force-release an asset still in use.
4. Remove the temporary owner and its final explicit reference after testing. Keep the Web preview evidence separate from native behavior.

The first six-cycle probe stores only a temporary JS reference on a Node. A later four-swap Web probe shows red/blue on a temporary Sprite and retains blue if the next load fails; see the screenshots and record in the [first slice](../../dynamic-content-first-slice.md). The normal-startup 2.4 Web channel now also has a real network-failure trace: four blue texture import requests were rejected, `cc.resources.load` returned a `download failed` error, the runtime reported `retained`, Host kept the blue pointer selected but red effective, then rollback and retry restored a successful blue apply. See the [channel trace](../../content-runtime-web-0.1.md). A rebuilt Mac package verifies four resource load/ref/release cycles and failed-load retention, but does not verify native pixels or native version switching. In this 2.4 Mac package, use the texture's `_uuid` to query `assetManager.assets`; its `uuid` was undefined. Rendered temporary SpriteFrame texture UUID may be empty after dynamic atlas processing. Frame budget, mobile, remote delivery and hot update remain unverified.
