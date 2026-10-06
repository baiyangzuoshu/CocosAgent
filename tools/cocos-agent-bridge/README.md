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

此外还没有重试持久化、断线恢复、进度推送、取消、并行项目隔离或正式安全审查。
