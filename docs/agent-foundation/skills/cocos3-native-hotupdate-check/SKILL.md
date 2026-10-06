---
name: cocos3-native-hotupdate-check
description: Diagnose Cocos Creator 3.8 native.AssetsManager version checks, file updates, cache/search paths, and JS/C++ state mismatch; use for native hot updates, not assetManager loading.
---

# Cocos Creator 3.8 原生版本检查

先按[3.8 官网机制](https://docs.cocos.com/creator/3.8/manual/zh/advanced-topics/hot-update-manager.html)确定 manifest、可写缓存、搜索路径和重启要求。公开入口是 `native.AssetsManager`；`assetManager` 处理运行时 Asset/Bundle，不能替代文件热更新诊断。源码从 `cocos/native-binding/impl.ts` 追到 `native/extensions/assets-manager/AssetsManagerEx.cpp`、`Manifest.cpp`，同时核对目标包实际内置引擎版本。

记录本地/远端 manifest 版本、构造前后 `jsb.fileUtils.getSearchPaths()`、`getStoragePath()`、事件代码、`getState()` 和服务器请求。`AssetsManagerEx::loadLocalManifest` 可前置搜索路径并清理旧缓存；纯只读现场排查不要构造管理器。受控复现用唯一临时目录及回环服务器，只清理实验目录。

**逐项核对状态常量。** 本仓库 3.8.7 C++ `AssetsManagerEx.h::State` 含 `PREPARE_UPDATING`，`platforms/native/engine/jsb-assets-manager.js` 的 JS 状态表缺该项。本仓库[Mac 包同版本轨迹](../../traces/3.8.7-stage11-mac-native-hotupdate-check.jsonl)在 `ALREADY_UP_TO_DATE=4` 回调时读到 `getState()=13`，同包 JS 常量却为 `UP_TO_DATE=12/FAIL_TO_UPDATE=13`。不要用 `getState() === State.FAIL_TO_UPDATE` 单独判失败；以事件、manifest 与[服务端请求](../../traces/3.8.7-stage11-mac-native-hotupdate-check-server.jsonl)共同判断，并在目标包重新核对枚举。

同版本轨迹只调用 `checkUpdate()`，只请求 `version.manifest`，不下载资源。复跑设计见[受控探针](../../probes/stage11-mac-hotupdate-check.py)，完整边界见[独立研究笔记](../../../3.x/11-auxiliary-capabilities.md)。

[新版本检查轨迹](../../traces/3.8.7-stage11-mac-native-hotupdate-new-version-check.jsonl)依次给 `5 → 5 → NEW_VERSION_FOUND=3`。[服务端](../../traces/3.8.7-stage11-mac-native-hotupdate-new-version-check-server.jsonl)仅见版本与完整 manifest 请求；临时缓存有 `project.manifest.temp`，没有哨兵资产请求。代码 3 回调的 `getState()=10` 对应 C++ `READY_TO_UPDATE`，却被包内 JS 表标为 `UPDATING`；不能以该 JS 常量判断已经开始下载。此分支仍只调用 `checkUpdate()`。

在代码 3 回调再调用 `update()`，[单文件成功轨迹](../../traces/3.8.7-stage11-mac-native-hotupdate-update.jsonl)记录代码 8（`UPDATE_FINISHED`）、缓存版本 `1.0.1`、正确单字节文件与前置的缓存目录；[服务器](../../traces/3.8.7-stage11-mac-native-hotupdate-update-server.jsonl)见到该文件请求。独立重启后重新构造管理器读取缓存版本 `1.0.1`，再检查返回代码 4。代码 8/4 的 `getState()=13` 在邻接 C++ 是 `UP_TO_DATE`，不能按包内 JS `FAIL_TO_UPDATE=13` 误判。此实验没有验证更新后游戏脚本的启动前覆盖、Bundle 刷新、失败重试或回滚。
