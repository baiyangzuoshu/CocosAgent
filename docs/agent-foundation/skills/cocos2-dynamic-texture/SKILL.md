---
name: cocos2-dynamic-texture
description: Diagnose repeated Texture2D loading, replacement, references, and release in Creator 2.4.15.
---

# Creator 2.4 dynamic texture

Use this skill when analyzing runtime texture replacement in 2.4.15. Read the [2.4 release manual](https://docs.cocos.com/creator/2.4/manual/zh/asset-manager/release-manager.html) and [measured first slice](../../dynamic-content-first-slice.md).

For a named local content version, inspect the [CocosAgent 0.1 release contract](../../content-release-0.1.md) first. Its `content.select` changes only Host metadata, not the running game. Resolve each declared PNG in the built-in `resources` bundle by its base name; check the exact Creator version, staged fingerprint and dependency declaration before runtime work.

For the [measured Web runtime flow](../../content-runtime-web-0.1.md), pass the selected record to the 2.4 adapter, wait for its `applied` receipt and a visible frame, then submit the matching fingerprint, `_uuid` and positive reference count through `content.runtime.accept`. On `retained`, keep the old Sprite and return the Host pointer to the effective release; do not record the failed candidate as effective. The current adapter is injected by a test harness and has no persistent game hookup.

1. Confirm the asset is in the intended bundle and read its 2.4 `.meta` UUID/type. For these imported PNGs, `cc.resources.load(name, cc.Texture2D)` resolves the main texture.
2. Load the next asset, call `addRef()` for the owner, then switch the owner reference. Only after the switch, call `decRef()` on the previous owned asset.
3. Observe `refCount`, `cc.assetManager.assets.has(uuid)`, validity and time after non-forced `releaseUnusedAssets()`. Do not force-release an asset still in use.
4. Remove the temporary owner and its final explicit reference after testing. Keep the Web preview evidence separate from native behavior.

The first six-cycle probe stores only a temporary JS reference on a Node. A later four-swap Web probe shows red/blue on a temporary Sprite and retains blue if the next load fails; see the screenshots and record in the [first slice](../../dynamic-content-first-slice.md). A rebuilt Mac package also verifies four resource load/ref/release cycles and failed-load retention, but does not verify native pixels. In this 2.4 Mac package, use the texture's `_uuid` to query `assetManager.assets`; its `uuid` was undefined. Rendered temporary SpriteFrame texture UUID may be empty after dynamic atlas processing. Frame budget, mobile and hot update remain unverified.
