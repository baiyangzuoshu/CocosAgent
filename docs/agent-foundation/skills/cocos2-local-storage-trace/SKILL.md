---
name: cocos2-local-storage-trace
description: Diagnose Cocos Creator 2.4.15 cc.sys.localStorage availability, platform provider, and persistence using this workspace's source and reversible probes.
---

# Trace 2.4.15 localStorage

Use when a 2.4.15 project loses a saved setting or differs between Web and native. Read the [2.4 source map](../../../2.x/11-auxiliary-capabilities.md) and [validation record](../auxiliary-capabilities-validation.md). The existing [Mac trace](../../traces/2.4.15-stage11-mac-native-storage.jsonl) proves only that package's write, restart read, and removal.

1. Check the matching [2.4 storage manual](https://docs.cocos.com/creator/2.4/manual/zh/advanced-topics/data-storage.html). Record exact Creator version, runtime target, preview versus published build, and engine source. Use `cc.sys.localStorage`, not an assumed global database path.
2. Follow `engine/2.4.15engine/cocos2d/core/platform/CCSys.js`: JSB uses `window.localStorage`; Web probes it with a temporary write/remove and falls back to warning functions if unavailable. The 2.4 native SQLite binding is absent from this engine directory, so stop at the host boundary.
3. In the affected runtime, record `CC_JSB`, `cc.sys.isNative/isBrowser`, `typeof window.localStorage`, and whether it is the same object as `cc.sys.localStorage`. A native adapter may expose `window`.
4. Test one newly generated, namespaced key: read before, set string value, read after, restart the same package, read again, remove only that key, and confirm it is absent. Preserve errors and event order. Do not use `clear()` for diagnosis.
5. Check serialization and caller timing separately if the storage provider works. Compare Web and native only with separate traces; the Mac package does not establish browser, mini-game or mobile persistence.

The [Mac probe](../../probes/stage11-mac-storage.py) temporarily edits generated app scripts and restores their bytes. Use it only when its two package paths match the intended examples; otherwise adapt a probe for the actual project. Report package provenance and cleanup with the result.
