# CocosAgent 本地通信原型

此原型验证 Agent 本地服务与 Creator 版本专属扩展之间的 WebSocket 会话，并提供 PNG 导入和场景 Sprite 操作。桥接 Host 与 MCP Server 不调用 LLM；2.4.15 内置 Assistant 通过独立服务调用 DeepSeek。

## 已实现的协议步骤

1. Agent 服务仅绑定 `127.0.0.1`，选择系统分配的端口。
2. Agent 写入项目 `temp/cocos-agent-bridge/session.json`，包含协议版本、项目路径、Creator 版本、会话地址和随机令牌。该目录由 Creator 忽略；文件权限设为当前用户可读写。
3. 对应版本的扩展读取本项目会话文件，检查项目路径、Creator 版本、协议版本和有效期，然后连接本机服务。
4. 扩展发送 `hello`；Agent 校验项目、Creator 版本、扩展名和协议版本。
5. Agent 发送固定 `bridge.ping` 请求；扩展回传 nonce、Creator 版本和项目路径。
6. Agent 发送只读 `scene.snapshot` 请求；对应版本的 Scene Script 返回当前场景名称及有界节点摘要（最多 30 个节点、深度 6，名称和路径也有长度上限）。写入后可按目标节点名做独立查找，最多扫描 10,000 个节点，避免节点摘要截断导致误报。
7. 如果传入 `--png`，Agent 检查 PNG 头、尺寸、文件大小和文件名，将文件复制到项目 `temp/` 下的会话隔离目录；扩展校验会话、路径、签名与 SHA-256 后，调用本版 AssetDB 导入到 `assets/resources/`。Agent 校验返回的资源 URL、UUID、类型、导入状态和内容摘要，然后清理临时文件。
8. 对已导入的 `assets/resources/*.png`，可请求 `scene-action apply|compensate|replay`。扩展按版本解析 SpriteFrame 或 Texture2D 子资源，在当前编辑场景新增或删除专用 Sprite 节点，调用编辑器保存接口；Host 再检查场景文件序列化内容。`replay` 使用稳定节点名重做 apply，重复 apply 应识别为已应用，不额外创建节点。
9. 2.4.15 的 `scene.node.create` 另支持在已定位的父节点下创建 Sprite 或 Label 单组件节点、引用已导入的 SpriteFrame UUID、设置二维位置与缩放；保存后检查 `.fire`、自动启动 Web 预览并读回运行时节点。Creator 3.8.7 目前仍只接受空节点输入。
10. 仅 2.4.15 的 `assets.scene.*` 流水线把 PNG 计划、AssetDB 导入、Texture/SpriteFrame `.meta` 与 UUID 校验、Canvas Sprite 写入、预览回执和失败补偿串联。执行状态保存在 `.cocos-agent/asset-scene-pipelines/`；补偿先移除本流水线的场景节点，再通过 `Editor.assetdb.delete` 删除身份仍匹配且没有序列化 UUID 引用的资源。`assets.scene.validate` 只读核对磁盘、AssetDB、活动场景与序列化引用；`assets.scene.repair` 仅在身份全部一致而 URL→UUID 映射陈旧时调用 `Editor.assetdb.refresh`，不编辑 `.meta`。合同、调用参数、失败状态与实机验证范围见 [`cocos-agent-resource-scene-pipeline-0.1.md`](../../docs/agent-foundation/cocos-agent-resource-scene-pipeline-0.1.md)。
11. 2.4.15 的只读 `asset.searchPng` 通过 Creator AssetDB 查询 PNG 主资源，再核对磁盘 `.meta` 的 Texture UUID 与唯一 SpriteFrame 子资源 UUID；只返回项目相对 URL、UUID、尺寸和元数据状态，不返回绝对路径，也不修改资源或场景。仅 `metadataStatus: valid` 的结果含 `spriteFrameUuid`，可作为后续 Sprite 命令输入。其实现使用 Creator 2.4 的 [`Editor.assetdb.queryAssets`](https://docs.cocos.com/creator/2.4/manual/zh/extension/api/asset-db/asset-db-renderer.html)；不支持 3.x。

Agent key 不参与此流程，也不会写入项目。WebSocket 会话令牌只用于本机桥接认证。

## MCP stdio 适配器（2.4.15）

通用 MCP 宿主可通过 [`mcp/mcp-server.mjs`](mcp/mcp-server.mjs) 使用已实现的实例查询、能力目录、语义命令、2.4 Web-Mobile 构建和构建包预览。适配器只注册启动参数中列出的绝对项目路径，并固定 Creator 2.4.15；MCP 宿主提供模型，CocosAgent 不配置或调用 LLM Key。安装依赖、宿主配置、工具状态和验收边界见[适配层合同](../../docs/agent-foundation/cocos-agent-mcp-0.1.md)。

## Creator 原生 Agent（2.4.15）

Creator 菜单 `扩展 → CocosAgent → Assistant` 打开对话面板。Creator 扩展管理 Assistant sidecar 的启动、停止、当前项目注册和写入审批；sidecar 自己启动 MCP stdio 子进程，但不依赖 Codex、Codex 插件缓存或 Codex MCP Host。现有 Ask/Plan/Agent、语义命令、操作回执和恢复账本继续复用。可选 `deepseek-flash` 与 `deepseek-v4-pro`，真实模型验收使用 Flash。Key 保存在当前 OS 用户的 `~/.cocos-agent/credentials.env`（Windows `%USERPROFILE%` 下），文件为明文；POSIX 下限制为用户可读写。连接后密码框会清空。扩展主进程将密钥经子进程环境传给本地 `assistant-host.mjs`，MCP 子进程不会继承 `DEEPSEEK_*` 环境变量，Key 不放入命令行或操作轨迹。关闭 Creator 或重载扩展会停止本地 Assistant 服务。

Ask 和 Plan 仅向模型暴露 MCP 标记为只读的工具；Plan 用只读工程信息生成步骤，不执行写入。Agent 可使用当前 2.4.15 MCP 工具，但每个非只读工具调用都会先在面板显示工具名和参数，等待用户批准。编辑器操作仍由现有 MCP Server、Host 合同和版本扩展执行；模型服务没有任意文件写入或任意 JavaScript 工具。

本机需安装 Node.js 20+。从仓库构建独立扩展包：`node tools/cocos-agent-bridge/package-creator-extension.mjs bundle --output /absolute/path/CocosAgentCreatorPackage`。若希望跨工程使用，将生成目录安装到 Windows `%USERPROFILE%\.CocosCreator\packages\cocos-agent-bridge`（macOS `~/.CocosCreator/packages/cocos-agent-bridge`）；Creator 2.4.15 也支持项目级 `packages/`，但全局安装可让 Agent 与游戏工程文件分离。扩展从 `Editor.Project.path` 取得当前活动工程，并要求目标含有效 `project.json`。更新现有扩展时先关闭 Creator，再运行 `upgrade-extension --extension <绝对扩展目录>`；命令在同级保留旧包回滚副本，并报告需要重载 Creator。若升级后验证失败，可运行 `restore-extension --extension <绝对扩展目录> --rollback <命令返回的回滚目录>`。开发时可用 `install-runtime --extension <绝对扩展目录>` 只安装运行时。当前源包版本为 extension 0.3.20、MCP 0.3.7、skills 0.3.7，包含 17 个技能、37 份引用资料和所需性能探针；不包含 Codex 插件元数据或本机 MCP 配置。0.3.19 重构 Creator 面板布局；0.3.20 优化回复排版：助手正文采用更宽的无卡片阅读区，段落按 Markdown 软换行合并，标题、列表、行内代码和代码块层级更清晰，复制操作放入消息标题栏。若扩展进程找不到 `node`，可在启动 Creator 前设置 `COCOS_AGENT_NODE` 指向 Node 20+ 可执行文件。会话、计划和紧凑任务状态保存在按工程路径隔离的 OS 用户状态目录；凭据、截图和原始工具参数不会进入会话文件。任务与模型最终回答仍会进入用户状态目录下的 Agent 运行轨迹。2026-10-10 已在 Windows Creator 2.4.15 面板实测 DeepSeek Flash 的 Ask、Plan、写入拒绝、批准创建空节点、按来源记录补偿和失败对账；临时节点已清除，场景恢复到测试前 SHA-256。0.3.2 新增的运行观察通过模拟合同与 Agent 编排测试；Creator 实机运行错误注入、修复和二次观察尚未验收。LinkUpClient 磁盘扩展已升级至 0.3.19 并保留回滚目录；0.3.20 的 Creator 原生重载验收尚待完成。

## 启动

先确保对应 Creator 工程已打开并启用 `cocos-agent-bridge` 扩展，然后在仓库根目录运行对应命令：

```sh
node tools/cocos-agent-bridge/bridge-host.js \
  --project "$PWD/3.8,7NewProject" \
  --creator-version 3.8.7
```

```sh
node tools/cocos-agent-bridge/bridge-host.js \
  --project "$PWD/2.4.15NewProject" \
  --creator-version 2.4.15
```

启动后，服务等待最多 15 秒完成握手，随后验证 `bridge.ping` 和只读 `scene.snapshot`。执行 `asset.searchPng` 时，Host 在 `bridge.ping` 后直接读取 AssetDB，不依赖活动场景。2.4 新增 `packages/` 扩展后需重开工程；3.8 可在扩展管理器刷新并启用项目扩展。

导入一张 PNG 时，在对应命令中追加 `--png /绝对路径/图片.png`。目标文件名必须在 `assets/resources/` 中尚不存在；冲突会拒绝，不覆盖或自动改名。2.4 使用 `Editor.assetdb.import`，3.8 使用 AssetDB 消息 API；两者使用各自版本的编辑器导入机制。

对仓库中已经导入的测试图 `cocos-agent-smoke.png` 试跑场景操作：

```sh
node tools/cocos-agent-bridge/bridge-host.js \
  --project "$PWD/2.4.15NewProject" \
  --creator-version 2.4.15 \
  --scene-asset cocos-agent-smoke.png \
  --scene-action apply
```

将版本和项目路径换成 3.8 后也可独立运行。先 `apply`，再用 `compensate` 删除 Agent 创建的节点，用 `replay` 再次创建。每次只能有一个 Host 连接对应项目扩展；运行前先在 Creator 刷新/重载本项目扩展。此操作会修改并保存当前打开的场景，因此应先确认当前场景。成功回执包含场景名、节点身份和保存状态；预览仍由 Creator 或浏览器操作，尚未集成到 Host 命令。

## 扩展与依赖

- 2.4 入口：`2.4.15NewProject/packages/cocos-agent-bridge/main.js`
- 3.8 入口：`3.8,7NewProject/extensions/cocos-agent-bridge/dist/main.js`
- Agent 服务：`tools/cocos-agent-bridge/bridge-host.js`
- 为支持当前无 npm 网络的环境，原型固定使用 `ws` 7.5.10；上游 MIT 许可证和源码保存在 `vendor/ws/`。发布产品前应评估升级到受支持版本。

## 验证边界

2026-10-06，Creator 2.4.15 与 3.8.7 已完成本机连接、版本与项目握手、`bridge.ping` 往返、真实 `scene.snapshot` 和单 PNG 导入。两版均回传 `stage8-audio-static`；2.4 返回 9 个节点，3.8 达到 30 节点上限并正确标记截断。记录见 `docs/agent-foundation/traces/cocos-agent-scene-snapshot-0.1.jsonl` 和 `docs/agent-foundation/traces/cocos-agent-asset-import-0.1.jsonl`。

首轮 2.4 测试证实 AssetDB 按暂存文件 basename 决定资源名；实现已调整为在会话隔离子目录中保留原文件名。修正后，两版均已实测导入 `assets/resources/cocos-agent-smoke.png` 并生成 Creator 元数据；再以同名导入均返回 `ASSET_CONFLICT`，没有覆盖已有文件。2.4 AssetDB 回报类型为 `texture`，3.8 为 `cc.ImageAsset`，因此上层接口保留 Creator 原生类型字符串，不把类型名强行归一化。该测试只验证单张 PNG，不代表批量导入。预览控制和构建钩子尚未实现。

两版真实 Creator 均完成了放置、保存、预览、补偿、重放、再次补偿的单资源闭环。2.4.15 在 `helloworld.fire` 的现有 Canvas 下放置 Sprite；3.8.7 的 `main.scene` 原无 Canvas，扩展创建 `CocosAgentCanvas` 和 UI 相机。两个 Web 预览都目视确认了场景中央的测试图片；Host 对场景操作核对内存快照和磁盘中 SpriteFrame 引用。最终两份磁盘场景均无 `CocosAgent` 节点。3.8 首次创建 Canvas 时，编辑器报告保存成功早于磁盘读回完成，Host 现以短时轮询核对；同一节点的幂等 apply 随后通过。2.4 曾试用未核实参数的撤销记录消息，编辑器报 `Unknown object to record`，现已移除，该错误不影响已验证的保存与补偿。该单资源切片只覆盖两套示例、单张 2×2 PNG 和 Web 预览；复杂 UI 布局、原生预览及 `scene.pngSprite` 自动预览仍未验证。2.4 `scene.node.create` 的 Sprite/Label 组件、自动运行时预览和场景切换后重开读回是独立 P1 切片，见 [`scene.node.create 0.1`](../../docs/agent-foundation/scene-node-create-0.1.md)。

本轮操作与预览观察记录在 `docs/agent-foundation/traces/cocos-agent-scene-write-web-0.1.jsonl`。
验收后，两份示例场景已按试验前备份逐字节恢复；导入的测试 PNG 及其 `.meta` 仍保留，供复测使用。

## 操作合同 0.1

`scene.pngSprite` 的六阶段输入、回执和错误状态见 `tools/cocos-agent-bridge/operation.schema.json` 与 `docs/agent-foundation/cocos-agent-operation-contract-0.1.md`。两版扩展在握手中声明同一合同版本，各自执行场景预检；Host 验证预检后才写入。Host 输出 `operation.receipt {JSON}`，分别说明能力、预检、编辑器写入、磁盘读回、预览和恢复状态。写入当次的预览阶段先为 `pending`；调用方实际观察本次 Web 预览后，可经调度入口补记视觉回执。不能沿用此前操作的预览证据。

场景操作会输出独立于会话的 `operationId`，并写入项目 `.cocos-agent/operations/`。查看持久状态：

```sh
node tools/cocos-agent-bridge/bridge-host.js \
  --project "$PWD/2.4.15NewProject" --creator-version 2.4.15 \
  --operation-get "<operationId>"
```

同一 `operationId` 再次执行会被拒绝，避免 Host 重启后重做场景写入。`--interrupt-after-editor` 是故障注入选项：在编辑器成功回执后、Host 磁盘读回前退出；随后 `operation.get` 只读检查场景磁盘文件。该检查只在磁盘满足目标操作时补记 `disk=passed`，其余阶段保持原状态。本地 WebSocket 模拟扩展以及两版真实 Creator 均已完成中断、Host 新进程读回、重复读取和按身份补偿测试，证据见 `docs/agent-foundation/traces/cocos-agent-operation-persistence-0.1.jsonl`。旧版 3.8 扩展曾在预检拒绝独立 `operationId`；扩展重载后已通过实测。`operation.get` 返回的是该操作的历史回执；后续补偿或人工改动场景不会追溯修改原回执。当前恢复只补验磁盘，不自动重新执行写入，也不自动判定 Web 预览通过。

## 只读实例与命令目录

`catalog-host.js` 可在一次运行中连接多个已打开的 Creator 项目。扩展需先重载到含 `instanceId` 和 `capabilities.list` 的版本。调用示例：

```sh
node tools/cocos-agent-bridge/catalog-host.js \
  --target "2.4.15=$PWD/2.4.15NewProject" \
  --target "3.8.7=$PWD/3.8,7NewProject" \
  --query instances.list
```

将 `--query` 换成 `instances.get` 或 `capabilities.list` 时，另传 `--project` 指定项目绝对路径；建议同时传 `--creator-version 2.4.15|3.8.7` 核对预期版本。`instances.list` 列出显式配置的目标，不接受选择参数。输出为 `{success,data}` 或 `{success:false,error}` 的 JSON。项目没有对应目标返回 `EDITOR_NOT_FOUND`；同项目重复配置返回 `AMBIGUOUS_EDITOR`；选择版本或扩展握手版本不符返回 `CREATOR_VERSION_MISMATCH`，不会选择最近使用的窗口。目录在 2.4.15 有十个语义命令、在 3.8.7 有五个；每条声明合同版本、`access`、可直接读取的 `input` JSON Schema、`inputSchema` 引用、`preconditions`、`status` 和 `reason`。2.4 的 `asset.searchPng` 是只读 AssetDB PNG 查询，`asset.removeImportedPng` 仅用于流水线回滚，`asset.refreshFolder` 通过官方 AssetDB API 刷新一个已存在的项目资源目录。Host 会核对扩展返回的输入结构与 [catalog.schema.json](catalog.schema.json) 一致；编辑器写入的内部请求仍按 [operation.schema.json](operation.schema.json) 校验。`asset.importPng` 的公开输入是本地 PNG 路径，文件名由 Host 从路径提取；桥接线上的请求只引用经过 Host 校验的会话暂存清单。`available` 代表查询时命令及场景级条件满足，暂存文件、目标资源名与 SpriteFrame 仍须执行前重新校验。

场景脚本直接读取活动场景与 Canvas 状态；`scene.pngSprite` 在 2.4 缺 Canvas、或任一版本无活动场景时标为 `unavailable`。`catalogRevision` 随目录内容及场景名变化；Host 再读取一次场景，若两次场景名不同则返回 `SCENE_CHANGED`，调用方应重新查询。每次查询创建独立短时会话，结束后清除本轮会话文件；它不会导入资源或写场景，也还不是常驻的实例注册服务。扩展重载后需重新查询，新的实例 ID 应与此前不同。

双实例协议测试和两版 Creator 实机查询的 0.1 版已通过，记录见 `docs/agent-foundation/traces/cocos-agent-catalog-0.1.jsonl`。当前扩展的动态目录已通过模拟双实例、场景切换、扩展实例更新、读取期间场景变化测试；仍需在两版 Creator 重载后验证真实回执。本次 2.4 Package Manager 的 Reload 曾报 `package not found` 并卸载扩展；通过 Creator 重开项目后扩展重新加载。因此 2.4 扩展代码更新后建议完整重开项目，不能把 Package Manager 的 Reload 当成必然成功。

此外还没有重试持久化、断线恢复、进度推送、取消、并行项目隔离或正式安全审查。

## Agent 调度入口

需要由长期运行的 Agent 进程调用时，启动 `node tools/cocos-agent-bridge/agent-jsonl.js`，在 stdin 逐行发送 JSON 请求。它提供实例/能力查询、命令调度、场景组合、批量资源，以及本地内容版本的 `content.plan/stage/get/select/rollback`、从已验收 2.4 场景流水线生成清单的 `content.fromScene.plan/stage`、`content.runtime.accept`、2.4 Web-Mobile `content.build.plan/execute/get/reconcile` 和 `content.preview.start/get/stop`。选中版本只改 Host 指针；运行时成功回执另记 `effective`。构建使用隔离输出目录，Creator 2.4.15 通过 Launch Services 已由 `content.build.execute` 实机生成并校验红蓝资源，独立 `content.build.get` 读回 `completed`；构建包运行时也通过蓝色入口资源验收。请求格式和验收见 [`cocos-agent-local-api-0.1.md`](../../docs/agent-foundation/cocos-agent-local-api-0.1.md)、[`content-build-web-0.1.md`](../../docs/agent-foundation/content-build-web-0.1.md) 与 [`content-preview-web-0.1.md`](../../docs/agent-foundation/content-preview-web-0.1.md)。

2.4 Mac 原生开发包使用独立会话文件，不读取浏览器 URL。先从包内探针或运行日志取得 `jsb.fileUtils.getWritablePath()`，然后运行：

```sh
node tools/cocos-agent-bridge/runtime/content-runtime-host.js \
  --project "$PWD/2.4.15NewProject" \
  --creator-version 2.4.15 \
  --platform mac-native \
  --native-writable-path "/absolute/path/from/getWritablePath"
```

Host 仅监听 `127.0.0.1`，在该可写目录下创建权限为 `0700` 的 `cocos-agent/`，并以 `0600` 写入短时 `runtime-session.json`。在 15 分钟内启动该 Mac 包；运行时只在 2.4 OS X 原生环境读取该文件，Host 首次接受正确版本、场景和会话 ID 后删除文件。Web 预览需提供准确 loopback Origin 与会话令牌。Host 结束时也会删除仍属于本会话的文件。Mac 原生会话用于本机开发，不应复制进可分发包。

Creator 编辑器 Web 预览仍可直接运行独立 runtime Host 并传入 `--preview-url http://127.0.0.1:7456/`。构建包则在 JSONL Agent 中调用 `content.preview.start`，只对已验收且仍与 selected release 指纹匹配的 2.4 Web-Mobile 构建启动 loopback 静态服务和运行时 Host，返回带会话参数的 `previewUrl`；浏览器连接后，用 `content.preview.get` 查看运行状态和回执，结束时调用 `content.preview.stop`。静态服务只读服务隔离构建目录，不启动浏览器。Agent 进程应保持运行；关闭 stdin 会清理活动预览会话。

```sh
node tools/cocos-agent-bridge/runtime/content-runtime-host.js \
  --project "$PWD/2.4.15NewProject" \
  --creator-version 2.4.15 \
  --preview-url http://127.0.0.1:7456/
```

`agent-dispatch.js` 串联实例查询、能力查询、目标核对、命令执行和回执判定。只读示例：

```sh
node tools/cocos-agent-bridge/agent-dispatch.js \
  --target "2.4.15=$PWD/2.4.15NewProject" \
  --target "3.8.7=$PWD/3.8,7NewProject" \
  --project "$PWD/3.8,7NewProject" --creator-version 3.8.7 \
  --command scene.snapshot --input '{}'
```

场景写入把命令改为 `scene.pngSprite`，输入示例为 `{"assetName":"cocos-agent-smoke.png","action":"apply"}`。运行前应确认当前场景；成功保存后返回 `needs-preview`，人工预览仍是独立验收。`needs-review` 表示操作结果不确定，先按返回的 `operationId` 查询记录和场景，不自动重发。完整状态与验证边界见 [`cocos-agent-dispatch-0.1.md`](../../docs/agent-foundation/cocos-agent-dispatch-0.1.md)。

只读节点定位使用 `--command scene.node.inspect --input '{"nodePath":"main/Main Light"}'`；2.4 应传自己的活动场景路径，例如 `helloworld/Canvas/label`。返回 `found/not-found/ambiguous` 和有界节点摘要。双版本实机证据与路径约束见[节点检查合同](../../docs/agent-foundation/scene-node-inspect-0.1.md)。

节点写入使用 `scene.node.create`：先用节点检查取得父节点的路径和 UUID，再传 `{"parentPath":"helloworld/Canvas","parentUuid":"<UUID>","nodeName":"Example","action":"apply"}`。在 2.4.15 可选 `components`（一个 `cc.Sprite`+SpriteFrame UUID，或一个 `cc.Label`+文本）和 `transform.position/scale`；Sprite 与 Label 同属 `RenderComponent`，同一节点不可同时挂载。含组件写入会在磁盘读回后自动触发 2.4 Web 预览结构验收；编辑器场景重开仍需在 Creator UI 切场景再打开。补偿和重放均需传 `sourceOperationId`。3.8.7 目前仍是空节点合同。节点输入、回执和运行证据见[节点、组件与资源引用合同](../../docs/agent-foundation/scene-node-create-0.1.md)。

多节点组合通过 JSONL 的 `workflow.plan/execute/get/compensate/replay` 调用。它以有序步骤和前一步 `ref` 组成节点层级，逐步持久化操作 ID；2.4 可在不同节点挂接 Sprite/Label 与变换，3.8 仍为空节点；明确失败时逆序补偿，结果不确定时停止。两版真实编辑器已验证空节点组合，2.4 组件组合的实机验收见[场景组合合同](../../docs/agent-foundation/scene-composition-0.1.md)。

符合条件的历史不确定写入可通过 JSONL 的 `operation.reconcile` 显式对账。它需要同一 Creator 实例中的活动场景父节点/目标路径读回，再与磁盘场景核对；只有同时证明目标未写入才返回 `failed`、`sideEffect=none` 并追加恢复证据。它不重试场景写入。请求结构见 [`operation-reconcile.schema.json`](operation-reconcile.schema.json)。

多张 PNG 导入通过 JSONL 的 `assets.batch.plan/execute/get` 调用。它核对源文件摘要、Creator 导入回执及目标文件和 `.meta`，逐项保留状态；不自动删除已导入资源。两版已分别验证两张 PNG 的批量导入。输入与验证边界见[批量导入合同](../../docs/agent-foundation/asset-batch-0.1.md)。这些资源的 Web 运行时六轮加载、替换与释放证据见[动态内容首条切片](../../docs/agent-foundation/dynamic-content-first-slice.md)。

已导入图像放入场景可通过 `scene.sprites.plan/execute/get/compensate/replay` 编排既有的 `scene.pngSprite` 操作。此 Host 侧批次当前只对 2.4.15 开放；它检查活动 Canvas 和 SpriteFrame UUID，为每张图保留独立操作记录，明确失败时逆序补偿，不确定写入时停在 `needs-review`。可选 `positions` 按 `assets` 索引指定 Canvas 本地设计像素坐标（±4096），省略时仍居中；此输入不适用于 3.8.7。执行结果为 `needs-preview` 时，观察本次预览，并按返回的每项 `operationId` 录入预览回执后查询批次状态。双 Sprite 坐标读回、同屏预览和补偿已有 2.4.15 实机轨迹。合同见[2.4 场景 Sprite 批次](../../docs/agent-foundation/scene-sprite-batch-0.1.md)。

从新 PNG 到场景 Sprite 可使用 2.4.15 专属 `assets.scene.plan/execute/get/preview.accept/compensate`。它持久化一个父流水线，再串联 PNG 导入与元数据/UUID 校验、既有场景 Sprite 批次、逐项本次预览证据。确定失败时先撤销场景引用，再尝试移除本流水线确认创建且不再被项目序列化资源引用的资源；Host 复核文件哈希和 Texture/SpriteFrame UUID，扩展通过 `Editor.assetdb.delete` 删除。官方建议用 AssetDB 删除 API 保持文件、`.meta` 与数据库同步，见 [2.4 AssetDB API](https://docs.cocos.com/creator/2.4/manual/en/extension/api/asset-db/asset-db-main.html)。无法确定身份、引用或场景副作用时返回 `needs-review` 并停止删除。输入、状态和失败边界见[资源到场景流水线合同](../../docs/agent-foundation/cocos-agent-resource-scene-pipeline-0.1.md)；当前是否完成实机验收以该合同记录为准。

既有流水线资源的只读核验与安全重导入可调用 `assets.scene.validate` / `assets.scene.repair`。修复只覆盖唯一的 AssetDB URL 映射陈旧分支；PNG 字节、元数据 UUID、场景 Sprite 引用或批次记录不一致时会停止，不触碰 `.meta`。详见[资源到场景流水线合同](../../docs/agent-foundation/cocos-agent-resource-scene-pipeline-0.1.md#流程与不变量)。

Agent 目视检查**本次操作**的本地 Web 预览后，附证据录入预览回执：

```sh
node tools/cocos-agent-bridge/agent-dispatch.js \
  --project "$PWD/3.8,7NewProject" --creator-version 3.8.7 \
  --preview-accept "<operationId>" \
  --evidence '{"url":"http://127.0.0.1:7457/","observedAt":"2026-10-07T00:00:00.000Z","note":"测试图片出现在场景中央"}'
```

`observedAt` 应填写实际观察时刻。重复录入同一操作不会增加回执。随后使用相同项目和版本调用 `--operation-get <operationId>`，可在新进程中读取统一结果包；`disk=passed` 且 `preview=passed` 时返回 `completed`。结果合同见 [`dispatch-result.schema.json`](dispatch-result.schema.json)。两版真实 Web 预览已分别验证状态从 `needs-preview` 转为 `completed`，并在补偿后确认测试图消失。
