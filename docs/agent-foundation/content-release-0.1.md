# 动态内容本地版本合同 0.1

本合同只管理**当前工程已导入、将在构建包内的 `resources` PNG 纹理**。`content.plan` 是只读预检；`content.stage` 把通过预检的清单写成不可覆盖的版本记录；`content.select` 改变 Host 的本地选中指针；`content.rollback` 选回上一记录。这四步自身不修改 Creator 场景或运行中的游戏。另有 `content.runtime.accept` 核对运行时成功回执并记录独立的生效版本，详见[Web 预览首条接线](content-runtime-web-0.1.md)。它们都不是原生 `AssetsManager` 更新或远端 Asset Bundle 发布；后两类流程必须另建版本合同和平台验收。

输入 schema 见 [`content-release.schema.json`](../../tools/cocos-agent-bridge/content-release.schema.json)。例如一个版本包含 `contractVersion: "0.1"`、`releaseId`、精确 `creatorVersion`、`delivery: "built-in-resources"`、`entryAssetId`，以及最多 16 个 `{id, source, sha256, runtimePath, dependsOn}`。`source` 只能是本工程 `assets/resources/` 下的 PNG；依赖 ID 是**调用方声明的内容装配顺序**，当前不声称它等于 Creator 自动计算的资源依赖。每张图都要有 Creator `.meta`，摘要与原文件一致；3.8 还要有已导入的 texture 子资源。运行路径由版本核对：2.4 是主图片名，3.8 是 `主图片名/texture`。

Host 在 `.cocos-agent/content-releases/<releaseId>.json` 保存不可变记录和指纹，在同目录 `selected.json` 保存本地选择及上一个版本，`effective.json` 保存已核对的运行时成功回执。重复 staging 同一 ID/相同指纹是幂等的；同一 ID 不同内容被拒绝。选择需传 `expectedCurrent`，避免过期请求覆盖新选择；选择前重读文件、`.meta`、摘要和指纹。失败不修改指针。回退需传当前 ID 并且必须有上一版本；回退本身只更改 Host 选中指针。运行时 `retained` 回执不得登记为 `effective`。单项目仍按[调度合同](cocos-agent-dispatch-0.1.md)采用一个活动写操作；本版本文件协议未实现跨进程锁，因此不允许多个 Host 同时写同一项目。

实际部署路径目前就是当前工程的 Creator 构建包内 `resources`。2.4 游戏在 Web 预览、Mac 开发包和本机 Web-Mobile 构建包中已接入 Host 运行时通道；3.8 仍以独立验收宿主为主，尚无等价的正常启动接线。Web-Mobile 构建包的蓝红切换与回滚证据见[构建合同](content-build-web-0.1.md)；两版早期 Web 可见替换与 Mac 加载/释放证据见[动态内容首条切片](dynamic-content-first-slice.md)。这些本地回环不是已部署游戏能力；新的远端发布必须另外定义 URL、构建版本 Hash、依赖下载、缓存和回退策略。

### 从已验收场景流水线生成运行时版本（仅 Creator 2.4.15）

`content.fromScene.plan` 和 `content.fromScene.stage` 将[资源到场景流水线](cocos-agent-resource-scene-pipeline-0.1.md)接到本地内容版本。调用方显式给出 `pipelineId`、`releaseId`、入口 PNG 名称，以及每个 PNG 对应的稳定 `assetId` 和依赖 ID；源路径、SHA-256、Creator 资源 UUID 和 2.4 运行路径均从流水线记录及工程磁盘读回派生，不接受调用方覆盖。计划阶段要求父流水线为 `completed`，也就是场景写入已经逐项预览验收；随后再次实时核对 AssetDB、`.meta`、运行时 Sprite 引用和序列化场景关系，并由 `content.plan` 重验源文件摘要和纹理 UUID。任何资源身份变化或场景上下文变化都会阻断暂存。

`content.fromScene.stage` 只创建标准 `content-releases/<releaseId>.json` 不可变版本记录，不自动调用 `content.select`，不改场景，也不生成 Creator 构建包。Agent 应先检查返回清单和指纹，再按预期当前版本调用 `content.select`；运行时是否实际切换仍以认证通道的 `applied`/`already-active` 回执及 `effective.json` 为准。这个连接只适用于 2.4.15 已验收的 PNG Sprite 与内置 `resources`。现已新增独立的 2.4 Web-Mobile 构建切片，见[构建合同](content-build-web-0.1.md)；Bundle、远端分发、原生包增量更新和 3.8 适配仍未实现。

2026-10-07，两版示例中的红蓝 PNG 与真实 Creator `.meta` 已通过 `content.plan` 只读预检；[计划轨迹](traces/cocos-agent-content-release-plan-0.1.jsonl)分别记录版本指纹和 Texture2D UUID。自动化测试使用临时工程覆盖两版 `stage → select → get → rollback`、陈旧指针拒绝、依赖环和源文件改动阻断。当时真实示例尚未写入或选择内容版本。

2026-10-08，Creator 2.4.15 `helloworld` 实机完成“资源到场景流水线 → 预览验收 → `content.fromScene.plan/stage` → `content.select` → Web 运行时应用 → `effective` 回执”闭环。两张测试 PNG 先经 AssetDB 导入并写入 Canvas；预览中红蓝 Sprite 均可见。内容计划再次实时校验两项资产和场景引用为 `valid`，派生的 Texture UUID、源摘要与 2.4 无扩展名运行路径进入 release 清单；选择后运行时实际应用蓝色入口资源，回执为 `applied`、引用计数为 2，Host 接受 `runtime-observed`。完整记录见[实机轨迹](traces/cocos-agent-content-from-scene-2.4-web.jsonl)。

测试结束后流水线补偿通过，PNG、`.meta` 和临时场景 Sprite 已移除；测试 release、选中/生效指针和临时源图均已清理，`.fire` 文件按原 Git 字节恢复。此闭环仅验证 2.4.15 Web 预览和内置 `resources` 加载，不包括 Creator 构建产物、Bundle、远端分发、原生增量更新或 3.8。

官方基准：[2.4 配置和加载 Asset Bundle](https://docs.cocos.com/creator/2.4/manual/zh/scripting/asset-bundle.html)、[3.8 Asset Bundle 介绍](https://docs.cocos.com/creator/3.8/manual/zh/asset/bundle.html)、[2.4 资源释放](https://docs.cocos.com/creator/2.4/manual/zh/asset-manager/release-manager.html)、[3.8 资源释放](https://docs.cocos.com/creator/3.8/manual/zh/asset/release-manager.html)。本合同的 `releaseId` 是 CocosAgent 自有版本，不等同于 Creator 构建产生的 Bundle Hash。
