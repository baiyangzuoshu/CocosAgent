---
name: cocos3-dynamic-texture
description: Diagnose repeated Texture2D loading, replacement, references, and release in Creator 3.8.7.
---

# Creator 3.8 dynamic texture

Use this skill when analyzing runtime texture replacement in 3.8.7. Read the [3.8 release manual](https://docs.cocos.com/creator/3.8/manual/zh/asset/release-manager.html) and [measured first slice](../../dynamic-content-first-slice.md).

For a named local content version, inspect the [CocosAgent 0.1 release contract](../../content-release-0.1.md) first. Its `content.select` changes only Host metadata, not the running game. Resolve each declared PNG in the built-in `resources` bundle through its `/texture` subresource path; check the exact Creator version, staged fingerprint and dependency declaration before runtime work.

1. Confirm the asset is in the intended bundle and read its 3.8 `.meta` importer/subresource IDs. The tested PNGs require `resources.load(name + '/texture', Texture2D)`; the base name alone returned “Bundle resources doesn't contain …”.
2. Load the next asset, call `addRef()` for the owner, then switch the owner reference. Only after the switch, call `decRef()` on the previous owned asset.
3. Observe `refCount`, `assetManager.assets.has(uuid)`, validity and time after non-forced `releaseUnusedAssets()`. Do not force-release an asset still in use.
4. Remove the temporary owner and its final explicit reference after testing. Keep the Web preview evidence separate from native behavior.

The first six-cycle probe stores only a temporary JS reference on a Node. A later four-swap Web probe shows red/blue on a temporary UI Sprite and retains blue if the next load fails; see the screenshots and record in the [first slice](../../dynamic-content-first-slice.md). A rebuilt Mac package also verifies four resource load/ref/release cycles and failed-load retention, but does not verify native pixels. In the measured 3.8 preview, set the initial SpriteFrame before activating its temporary Canvas and set `packable=false` to keep that frame out of dynamic atlas processing. Frame budget, mobile and hot update remain unverified.
