---
name: cocos3-local-storage-trace
description: Diagnose Cocos Creator 3.8.7 sys.localStorage availability, native SQLite binding, and persistence using this workspace's source and reversible probes.
---

# Trace 3.8.7 localStorage

Use when a 3.8.7 game setting is missing or differs by target. Read the [3.8 source map](../../../3.x/11-auxiliary-capabilities.md) and [validation record](../auxiliary-capabilities-validation.md). The [Mac trace](../../traces/3.8.7-stage11-mac-native-storage.jsonl) covers one existing built-in-engine package, not adjacent engine modifications.

1. Check the [3.8 storage manual](https://docs.cocos.com/creator/3.8/manual/zh/advanced-topics/data-storage.html). Record exact target, preview/published state, package identity and engine provenance.
2. Follow `cocos/core/platform/sys.ts::init` for the public `sys.localStorage` assignment and warning fallback. For Native, inspect `native/cocos/bindings/manual/jsb_cocos_manual.cpp::register_sys_localStorage`, `native/cocos/storage/local-storage/LocalStorage.cpp` or the Android variant, and `platforms/native/builtin/jsb-adapter/window.js`. Do not apply Mac SQLite file details to Android or mini-game hosts.
3. Record `sys.isNative/isBrowser`, the actual `window.localStorage`, and whether `sys.localStorage` is that object. Use a unique namespaced key and record before/set/after, restart/read, then remove/read. Do not call `clear()`.
4. If the provider persists the string, inspect caller serialization, initialization order and key choice next. If the provider is the warning fallback, retain the original exception or availability condition. Diagnose each target independently.

The [Mac probe](../../probes/stage11-mac-storage.py) temporarily edits generated scripts and restores exact bytes; only use it for matching example package paths. The existing 3.8 Mac package uses Creator's built-in engine, so its trace cannot validate changes in adjacent `3.8.7engine/`.
