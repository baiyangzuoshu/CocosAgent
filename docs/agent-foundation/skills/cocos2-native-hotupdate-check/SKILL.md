---
name: cocos2-native-hotupdate-check
description: Diagnose Cocos Creator 2.4 native jsb.AssetsManager version checks, file updates, cache, and search paths; use for 2.4 hot updates, not ordinary assetManager loading.
---

# Cocos Creator 2.4 原生版本检查

先按[2.4 官网机制](https://docs.cocos.com/creator/2.4/manual/zh/advanced-topics/assets-manager.html)确认原生目标、manifest URL、可写目录与搜索路径，再看项目的 `jsb.AssetsManager` 创建与事件回调。`cc.assetManager` 的资源引用计数不是文件热更新状态。此仓库缺 2.4 原生 AssetsManager C++ 实现；遇到内部时序问题须以目标包和服务器轨迹为证。

诊断时记录本地 manifest 是否加载、版本号、`getStoragePath()`、构造前后 `jsb.fileUtils.getSearchPaths()`、每个事件代码及当时 `getState()`，并保留服务器请求日志。构造管理器可能立即前置搜索路径，故只读排查现场时先查看配置和已有实例，不随意构造新实例。测试另用隔离的可写目录与可控 manifest，且只清理自己的目录。

[本仓库 2.4.15 Mac 包的同版本轨迹](../../traces/2.4.15-stage11-mac-native-hotupdate-check.jsonl)显示 `checkUpdate()` 先给 `UPDATE_PROGRESSION=5`，后给 `ALREADY_UP_TO_DATE=4`；终态 `getState()=12` 等于包内 `State.UP_TO_DATE`。[服务端](../../traces/2.4.15-stage11-mac-native-hotupdate-check-server.jsonl)仅见一次 `version.manifest` 请求。这只是同版本检查，不证明新版本下载、覆盖、缓存清理、重启或其他平台。需要复跑时查看[受控探针](../../probes/stage11-mac-hotupdate-check.py)及[独立研究笔记](../../../2.x/11-auxiliary-capabilities.md)，按目标包路径改造，不直接对真实游戏缓存运行示例脚本。

[新版本检查轨迹](../../traces/2.4.15-stage11-mac-native-hotupdate-new-version-check.jsonl)在远端版本更高且有一个哨兵资产时，依次给 `5 → 5 → NEW_VERSION_FOUND=3`；代码 3 时 `getState()=9` 对应包内 `READY_TO_UPDATE`。[服务端](../../traces/2.4.15-stage11-mac-native-hotupdate-new-version-check-server.jsonl)仅见版本与完整 manifest 请求，临时缓存留有 `project.manifest.temp`，没有资产请求。不要把发现新版本解释成已下载或已生效。

若继续调用 `update()`，[单文件成功轨迹](../../traces/2.4.15-stage11-mac-native-hotupdate-update.jsonl)在代码 8（`UPDATE_FINISHED`）时读到本地版本 `1.0.1`，缓存含正确单字节文件和完整 manifest，缓存目录被前置到搜索路径。[服务器](../../traces/2.4.15-stage11-mac-native-hotupdate-update-server.jsonl)见到该文件请求。独立重启后重新构造管理器，读到缓存版本 `1.0.1`，再次 `checkUpdate()` 返回代码 4。此探针没有让新脚本参与游戏启动；不能从缓存存在推断启动前脚本覆盖、Bundle 刷新或失败回滚。
