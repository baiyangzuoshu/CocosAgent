# CocosAgent 本地通信原型

此原型验证 Agent 本地服务与 Creator 版本专属扩展之间的 WebSocket 会话，并提供 PNG 导入和场景 Sprite 操作。不调用 LLM。

## 已实现的协议步骤

1. Agent 服务仅绑定 `127.0.0.1`，选择系统分配的端口。
2. Agent 写入项目 `temp/cocos-agent-bridge/session.json`，包含协议版本、项目路径、Creator 版本、会话地址和随机令牌。该目录由 Creator 忽略；文件权限设为当前用户可读写。
3. 对应版本的扩展读取本项目会话文件，检查项目路径、Creator 版本、协议版本和有效期，然后连接本机服务。
4. 扩展发送 `hello`；Agent 校验项目、Creator 版本、扩展名和协议版本。
5. Agent 发送固定 `bridge.ping` 请求；扩展回传 nonce、Creator 版本和项目路径。
6. Agent 发送只读 `scene.snapshot` 请求；对应版本的 Scene Script 返回当前场景名称及有界节点摘要（最多 30 个节点、深度 6，名称和路径也有长度上限）。写入后可按目标节点名做独立查找，最多扫描 10,000 个节点，避免节点摘要截断导致误报。
7. 如果传入 `--png`，Agent 检查 PNG 头、尺寸、文件大小和文件名，将文件复制到项目 `temp/` 下的会话隔离目录；扩展校验会话、路径、签名与 SHA-256 后，调用本版 AssetDB 导入到 `assets/resources/`。Agent 校验返回的资源 URL、UUID、类型、导入状态和内容摘要，然后清理临时文件。
8. 对已导入的 `assets/resources/*.png`，可请求 `scene-action apply|compensate|replay`。扩展按版本解析 SpriteFrame 或 Texture2D 子资源，在当前编辑场景新增或删除专用 Sprite 节点，调用编辑器保存接口；Host 再检查场景文件序列化内容。`replay` 使用稳定节点名重做 apply，重复 apply 应识别为已应用，不额外创建节点。

Agent key 不参与此流程，也不会写入项目。WebSocket 会话令牌只用于本机桥接认证。

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

启动后，服务等待最多 15 秒完成握手，随后验证 `bridge.ping` 和只读 `scene.snapshot`。2.4 新增 `packages/` 扩展后需重开工程；3.8 可在扩展管理器刷新并启用项目扩展。

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

两版真实 Creator 均完成了放置、保存、预览、补偿、重放、再次补偿的单资源闭环。2.4.15 在 `helloworld.fire` 的现有 Canvas 下放置 Sprite；3.8.7 的 `main.scene` 原无 Canvas，扩展创建 `CocosAgentCanvas` 和 UI 相机。两个 Web 预览都目视确认了场景中央的测试图片；Host 对场景操作核对内存快照和磁盘中 SpriteFrame 引用。最终两份磁盘场景均无 `CocosAgent` 节点。3.8 首次创建 Canvas 时，编辑器报告保存成功早于磁盘读回完成，Host 现以短时轮询核对；同一节点的幂等 apply 随后通过。2.4 曾试用未核实参数的撤销记录消息，编辑器报 `Unknown object to record`，现已移除，该错误不影响已验证的保存与补偿。此验证只覆盖两套示例、单张 2×2 PNG 和 Web 预览；场景重开、复杂 UI 布局、原生预览及自动预览控制尚未验证。

本轮操作与预览观察记录在 `docs/agent-foundation/traces/cocos-agent-scene-write-web-0.1.jsonl`。
验收后，两份示例场景已按试验前备份逐字节恢复；导入的测试 PNG 及其 `.meta` 仍保留，供复测使用。

## 操作合同 0.1

`scene.pngSprite` 的六阶段输入、回执和错误状态见 `tools/cocos-agent-bridge/operation.schema.json` 与 `docs/agent-foundation/cocos-agent-operation-contract-0.1.md`。两版扩展在握手中声明同一合同版本，各自执行场景预检；Host 验证预检后才写入。Host 输出 `operation.receipt {JSON}`，分别说明能力、预检、编辑器写入、磁盘读回、预览和恢复状态。当前预览只由人工确认，每次 Host 运行的预览回执均为 `pending`，不能据此前一次预览推断本次运行已通过。

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

将 `--query` 换成 `instances.get` 或 `capabilities.list` 时，另传 `--project` 指定项目绝对路径；建议同时传 `--creator-version 2.4.15|3.8.7` 核对预期版本。`instances.list` 列出显式配置的目标，不接受选择参数。输出为 `{success,data}` 或 `{success:false,error}` 的 JSON。项目没有对应目标返回 `EDITOR_NOT_FOUND`；同项目重复配置返回 `AMBIGUOUS_EDITOR`；选择版本或扩展握手版本不符返回 `CREATOR_VERSION_MISMATCH`，不会选择最近使用的窗口。目录目前只含三个已实现的语义命令；每条声明合同版本、`access`、可直接读取的 `input` JSON Schema、`inputSchema` 引用、`preconditions`、`status` 和 `reason`。Host 会核对扩展返回的输入结构与 [catalog.schema.json](catalog.schema.json) 一致；编辑器写入的内部请求仍按 [operation.schema.json](operation.schema.json) 校验。`asset.importPng` 的公开输入是本地 PNG 路径，文件名由 Host 从路径提取；桥接线上的请求只引用经过 Host 校验的会话暂存清单。`available` 代表查询时命令及场景级条件满足，暂存文件、目标资源名与 SpriteFrame 仍须执行前重新校验。

场景脚本直接读取活动场景与 Canvas 状态；`scene.pngSprite` 在 2.4 缺 Canvas、或任一版本无活动场景时标为 `unavailable`。`catalogRevision` 随目录内容及场景名变化；Host 再读取一次场景，若两次场景名不同则返回 `SCENE_CHANGED`，调用方应重新查询。每次查询创建独立短时会话，结束后清除本轮会话文件；它不会导入资源或写场景，也还不是常驻的实例注册服务。扩展重载后需重新查询，新的实例 ID 应与此前不同。

双实例协议测试和两版 Creator 实机查询的 0.1 版已通过，记录见 `docs/agent-foundation/traces/cocos-agent-catalog-0.1.jsonl`。当前扩展的动态目录已通过模拟双实例、场景切换、扩展实例更新、读取期间场景变化测试；仍需在两版 Creator 重载后验证真实回执。本次 2.4 Package Manager 的 Reload 曾报 `package not found` 并卸载扩展；通过 Creator 重开项目后扩展重新加载。因此 2.4 扩展代码更新后建议完整重开项目，不能把 Package Manager 的 Reload 当成必然成功。

此外还没有重试持久化、断线恢复、进度推送、取消、并行项目隔离或正式安全审查。
