# 动态内容本地版本合同 0.1

本合同只管理**当前工程已导入、将在构建包内的 `resources` PNG 纹理**。`content.plan` 是只读预检；`content.stage` 把通过预检的清单写成不可覆盖的版本记录；`content.select` 改变 Host 的本地选中指针；`content.rollback` 选回上一记录。这四步自身不修改 Creator 场景或运行中的游戏。另有 `content.runtime.accept` 核对运行时成功回执并记录独立的生效版本，详见[Web 预览首条接线](content-runtime-web-0.1.md)。它们都不是原生 `AssetsManager` 更新或远端 Asset Bundle 发布；后两类流程必须另建版本合同和平台验收。

输入 schema 见 [`content-release.schema.json`](../../tools/cocos-agent-bridge/content-release.schema.json)。例如一个版本包含 `contractVersion: "0.1"`、`releaseId`、精确 `creatorVersion`、`delivery: "built-in-resources"`、`entryAssetId`，以及最多 16 个 `{id, source, sha256, runtimePath, dependsOn}`。`source` 只能是本工程 `assets/resources/` 下的 PNG；依赖 ID 是**调用方声明的内容装配顺序**，当前不声称它等于 Creator 自动计算的资源依赖。每张图都要有 Creator `.meta`，摘要与原文件一致；3.8 还要有已导入的 texture 子资源。运行路径由版本核对：2.4 是主图片名，3.8 是 `主图片名/texture`。

Host 在 `.cocos-agent/content-releases/<releaseId>.json` 保存不可变记录和指纹，在同目录 `selected.json` 保存本地选择及上一个版本，`effective.json` 保存已核对的运行时成功回执。重复 staging 同一 ID/相同指纹是幂等的；同一 ID 不同内容被拒绝。选择需传 `expectedCurrent`，避免过期请求覆盖新选择；选择前重读文件、`.meta`、摘要和指纹。失败不修改指针。回退需传当前 ID 并且必须有上一版本；回退本身只更改 Host 选中指针。运行时 `retained` 回执不得登记为 `effective`。单项目仍按[调度合同](cocos-agent-dispatch-0.1.md)采用一个活动写操作；本版本文件协议未实现跨进程锁，因此不允许多个 Host 同时写同一项目。

实际部署路径目前就是当前工程的 Creator 构建包内 `resources`。两版 Web 预览中，独立验收宿主已把选中记录交给版本专属运行时适配器并读回成功/失败状态；游戏本身尚未在场景中持久挂接 Host 通道，不能把这条测试通道当作已发布游戏能力。两版早期 Web 可见替换与 Mac 加载/释放证据见[动态内容首条切片](dynamic-content-first-slice.md)。新的远端发布必须另外定义 URL、构建版本 Hash、依赖下载、缓存和回退策略。

2026-10-07，两版示例中的红蓝 PNG 与真实 Creator `.meta` 已通过 `content.plan` 只读预检；[计划轨迹](traces/cocos-agent-content-release-plan-0.1.jsonl)分别记录版本指纹和 Texture2D UUID。自动化测试使用临时工程覆盖两版 `stage → select → get → rollback`、陈旧指针拒绝、依赖环和源文件改动阻断。真实示例尚未写入或选择内容版本，因此不能称为运行中的游戏已应用该版本。

官方基准：[2.4 配置和加载 Asset Bundle](https://docs.cocos.com/creator/2.4/manual/zh/scripting/asset-bundle.html)、[3.8 Asset Bundle 介绍](https://docs.cocos.com/creator/3.8/manual/zh/asset/bundle.html)、[2.4 资源释放](https://docs.cocos.com/creator/2.4/manual/zh/asset-manager/release-manager.html)、[3.8 资源释放](https://docs.cocos.com/creator/3.8/manual/zh/asset/release-manager.html)。本合同的 `releaseId` 是 CocosAgent 自有版本，不等同于 Creator 构建产生的 Bundle Hash。
