# CocosAgent MCP stdio 适配层 0.1

`tools/cocos-agent-bridge/mcp/mcp-server.mjs` 是既有本地 Agent JSONL API 的 MCP stdio 适配器。MCP SDK 管理 JSON-RPC、协议版本和工具输入校验；业务请求仍交给 `agent-jsonl.js`，再由既有调度器和 2.4.15 扩展处理。MCP 进程不调用 LLM，也不需要 Agent API Key；模型由启动它的 MCP 宿主提供。

## 首版边界

- 仅支持 Creator **2.4.15**。不提供 3.8 项目目标，不接收模型提供的 Creator 版本。
- 启动参数中的一个或多个 `--project` 组成可操作项目白名单；最多 8 个，必须是互不重复、已存在的绝对目录。实例选择和内容构建/预览只能引用白名单中的路径。
- 不暴露原始 WebSocket、任意脚本、任意文件写入或模型/API Key 配置。
- `cocos_2x_command_execute` 可调用目录内的语义命令，因其可能写入项目，MCP annotation 标为非只读和 destructive；调用前应先读能力目录，并只调用 `available` 项。具体输入、前置条件和状态仍由当前 Creator 扩展及 Host 再校验。
- 构建输出局限于既有 `content.build.*` 所校验的 2.4.15 Web-Mobile 隔离目录。预览仅对已完成构建开放 loopback 静态服务和运行时 Host，不会自动打开浏览器。
- MCP stdio 的 stdout 专用于协议帧；适配器不向 stdout 写日志。客户端断开/stdin EOF 时，MCP server 关闭活动的预览会话。
- `assets.scene.execute` 在 Worker 线程运行，避免 Creator Host 的同步等待阻塞 MCP 主事件循环；若客户端请求带有 progress token，工具会在每个真实 Host 命令前后发送进度通知。流水线运行期间，同项目其他写操作被拒绝；读取流水线回执仍可用。

## MCP 工具

| MCP 工具 | 访问级别 | 用途 |
| --- | --- | --- |
| `cocos_2x_instances_list` | 只读 | 查询启动时注册的 2.4.15 项目实例 |
| `cocos_2x_instances_get` | 只读 | 查询所选项目的在线状态 |
| `cocos_2x_capabilities_list` | 只读 | 查询命令合同、输入结构、访问级别与当前可用状态 |
| `cocos_2x_command_execute` | 写入可能 | 调度目录中的 2.4.15 语义命令，返回统一 Host 回执 |
| `cocos_2x_operation_get` | 只读 | 查询持久操作记录，供重新连接和不确定结果检查 |
| `cocos_2x_operation_reconcile` | 写 Host 恢复证据 | 对账符合条件的中断操作；不重放编辑器写入 |
| `cocos_2x_operation_preview_accept` | 写预览回执 | 登记本地预览中的可见结果；保留同阶段已有的运行态读回证据 |
| `cocos_2x_assets_scene_plan` | 只读 | 预检 2–16 张 PNG 的导入身份、活动场景 Canvas 与目标节点 |
| `cocos_2x_assets_scene_execute` | 导入资源并写场景 | 用 AssetDB 导入 PNG、核对 UUID，再创建 Sprite 节点并读回场景 |
| `cocos_2x_assets_scene_cancel` | 合作取消并可能触发补偿 | 请求活动流水线在安全写入边界停止，等待当前 Host 命令完成，并补偿本流水线的场景节点与导入资源 |
| `cocos_2x_assets_scene_get` | 读/刷新 Host 回执 | 查看流水线状态和逐项预览状态 |
| `cocos_2x_assets_scene_preview_accept` | 写预览回执 | 为流水线中的一项记录本地 Web 预览观察 |
| `cocos_2x_assets_scene_compensate` | 删除流水线资源 | 先撤销场景引用，再按身份与引用检查清理流水线导入的资源 |
| `cocos_2x_assets_scene_validate` | 只读 | 交叉检查 PNG、meta UUID、AssetDB、场景和批次记录 |
| `cocos_2x_assets_scene_repair` | 刷新 AssetDB 映射 | 仅修复验证为陈旧的 URL→UUID 映射，不改写 meta |
| `cocos_2x_content_from_scene_plan` | 只读 | 从已完成预览验收的场景流水线派生内容 release 清单和指纹 |
| `cocos_2x_content_from_scene_stage` | 写 Host release 记录 | 持久化不可变 release，不自动选择或构建 |
| `cocos_2x_content_get` | 只读 | 查询某 release、当前 selected 与 effective 指针 |
| `cocos_2x_content_select` | 写 Host 指针 | 以 `expectedCurrent` compare-and-set 选中 release；不会直接改运行中的游戏 |
| `cocos_2x_content_rollback` | 写 Host 指针 | 仅在当前版本匹配时选择上一个 release |
| `cocos_2x_content_build_plan` | 只读 | 校验 release 并查看构建计划 |
| `cocos_2x_content_build_execute` | 写入构建产物 | 生成并校验 Web-Mobile 包 |
| `cocos_2x_content_build_get` | 只读 | 读取持久化构建记录 |
| `cocos_2x_content_build_reconcile` | 修改 Host 记录 | 根据已有产物恢复 Host 构建记录，不会重启 Creator 构建 |
| `cocos_2x_content_preview_start` | 启动本机服务 | 为已完成且 release 指纹仍匹配的构建启动 loopback 预览 |
| `cocos_2x_content_preview_get` | 只读 | 读取预览连接状态和运行时回执 |
| `cocos_2x_content_preview_stop` | 结束本机会话 | 关闭预览运行时与静态服务 |

## MCP Resource 与 Prompt

| MCP 能力 | 名称/URI | 用途 |
| --- | --- | --- |
| Resource | `cocos://2x/agent/mcp-tools` | 返回仓库内 Creator 2.4 专属 MCP skill，包含实例选择、写入恢复、预览验收与 release 工作流 |
| Prompt | `cocos_2x_resource_to_scene_workflow` | 接收注册项目路径和用户请求，指导 Agent 查询实例与能力，再按计划、执行、读回、视觉验收的顺序处理 PNG 场景操作 |

Resource 只读取固定仓库 skill 文件，不接受任意文件路径。Prompt 的 `projectRoot` 由 MCP 启动时的项目白名单限制，并明确禁止对超时写入盲目重试、伪造视觉证据，或在用户未请求 release staging 时提交内容。Prompt 为用户请求提供可复用指引；它不启动模型，也不绕过各工具自己的 schema、实例检查和 Host 前置条件。

已通过官方 SDK 的 `StdioClientTransport` 对真实 MCP 进程验收 `resources/list/read` 与 `prompts/list/get`：读取到固定 2.4 skill，并确认 Prompt 展开了白名单内的项目路径及超时恢复、视觉证据要求。该检查没有查询 Creator 实例或调用模型；InMemoryTransport 另覆盖参数约束与请求映射。

实例调用顺序为：列出实例，选定列表中的 `projectRoot`，查询能力，再按回执决定是否调用命令。构建和预览工具也要求从实例列表选择项目；MCP 参数 schema 会将项目路径限制为本进程启动时配置的路径。

2.4 能力目录还提供只读 `asset.searchPng` 命令：输入 PNG 名称或路径片段，返回分页 AssetDB 结果、项目相对 URL、Texture UUID、经 `.meta` 核对的 SpriteFrame UUID、尺寸和 `metadataStatus`。它不依赖活动场景，也不写资源或场景；后续 Sprite 操作只应使用 `metadataStatus: valid` 的 `spriteFrameUuid`。查询依据 Creator 2.4 的 [`Editor.assetdb.queryAssets`](https://docs.cocos.com/creator/2.4/manual/zh/extension/api/asset-db/asset-db-renderer.html) API，3.8 目录不暴露此命令。

资源到场景的建议顺序为 `assets_scene_plan → assets_scene_execute → assets_scene_get/validate → 浏览器逐项检查 → assets_scene_preview_accept → assets_scene_get`。如果结果不满足预期，调用 `assets_scene_compensate`；它会先恢复场景引用，再经 AssetDB 清理由该流水线导入且确认无引用的资源。`assets_scene_repair` 只用于验证返回 `repairable` 的陈旧 AssetDB 映射。完成视觉验收后，调用 `content_from_scene_plan`，明确检查 release ID、入口资源、稳定 asset ID、依赖关系、派生 UUID 和 fingerprint，再调用 `content_from_scene_stage`。随后通过 `content_select` 并携带 `expectedCurrent` 选择版本；此步骤只改 Host 指针。要将内容交给 Web 包，继续按 `content_build_plan/execute` 构建，再用 `content_preview_start/get/stop` 检查运行时回执；若需恢复之前版本，使用 `content_rollback` 并检查运行时回执。工具使用 2.4.15 Host 的既有合同；详细前置条件见[资源到场景合同](cocos-agent-resource-scene-pipeline-0.1.md)、[内容 release 合同](content-release-0.1.md)、[Web-Mobile 构建合同](content-build-web-0.1.md)和[本机预览合同](content-preview-web-0.1.md)。

`cocos_2x_operation_preview_accept` 只接受 loopback HTTP URL。preview 阶段仍待验收时，它创建视觉回执；自动运行态检查已通过时，它会把视觉观察作为额外证据追加到现有 preview 回执，不覆盖原有 runtime 状态证据。相同视觉证据重复提交幂等；每个回执最多保留 8 条证据。

### 长操作进度

只有 `cocos_2x_assets_scene_execute` 已切到 Worker 线程。它会在每个 Host 命令开始和完成时发出进度事件，内容只含命令、阶段和结果，不含本地路径。MCP 客户端需在请求中提供 progress token 才会收到通知；是否据此延长客户端等待时间由客户端决定。

流水线执行期间，同一项目的重复 execute 返回 `PIPELINE_EXECUTION_IN_PROGRESS`；其他非只读操作返回 `EDITOR_BUSY`。此时可调用 `assets_scene_get` 查看已有回执。只有用户明确要求取消时才调用 `assets_scene_cancel`。它对活动 Worker 设置共享取消标记；当前 Host 命令不被强杀，随后在下一写入边界停止，并尝试按“场景引用先、导入资源后”补偿。取消结果仍须以流水线回执为准，状态不确定时保留 `needs-review`。请求超时或客户端断开本身不会取消 Worker，也不证明写入失败：先读取流水线和操作记录，再决定补偿；不要盲目重发。其余 MCP Host 调用仍可能同步阻塞，跨进程重连恢复尚未实现。

## 启动和配置

依赖锁定在 MCP TypeScript SDK v2 `2.3.1` 与 Zod `4.6.5`。SDK 使用 Node.js 20 或更新版本；此工作区以 Node.js 22.22.2 完成验收。安装及运行测试：

```sh
cd tools/cocos-agent-bridge/mcp
npm ci
npm test
```

直接启动 stdio 服务（替换为本机仓库和工程的绝对路径）：

```sh
node /absolute/path/Cocos_Engine/tools/cocos-agent-bridge/mcp/mcp-server.mjs \
  --project /absolute/path/Cocos_Engine/2.4.15NewProject
```

若要管理多个 2.4.15 工程，重复传入 `--project`。通用 MCP 宿主的配置形式如下；`command` 应指向 Node.js 可执行文件，`args` 中使用本机绝对路径：

```json
{
  "mcpServers": {
    "cocos-agent-2x": {
      "command": "/absolute/path/to/node",
      "args": [
        "/absolute/path/Cocos_Engine/tools/cocos-agent-bridge/mcp/mcp-server.mjs",
        "--project",
        "/absolute/path/Cocos_Engine/2.4.15NewProject"
      ]
    }
  }
}
```

配置后，MCP 宿主应能读取工具列表。调用 `instances.list` 与 `capabilities.list` 只做本机编辑器握手和目录查询，不写入场景。构建、导入、场景修改等操作仍由各工具自己的 access annotation、参数约束和 Host 回执表达。

官方协议与接口依据：[MCP TypeScript SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/)、[stdio transport](https://ts.sdk.modelcontextprotocol.io/v2/serving/stdio)、[构建 MCP server](https://ts.sdk.modelcontextprotocol.io/v2/get-started/first-server)。

## 验收与限制

自动测试使用官方 MCP SDK 的 Client、Server 和 `InMemoryTransport`：确认工具发现、2.4 目标固定、实例选择、共享 JSONL 路由、错误保留、命令专属输入拒绝及操作记录、对账和预览回执的请求映射。官方 MCP SDK `StdioClientTransport` 连接真实 2.4.15 工程后，发现 14 个工具、选中 `helloworld` 实例、读取 8 项可用命令，并经 MCP 完成只读 `scene.snapshot`。随后通过 MCP 在 `Canvas` 下创建带 `cc.Label` 的临时节点：编辑器保存、磁盘读回和 Chrome 运行态属性检查均通过；浏览器截图实际显示 “MCP WRITE VERIFIED”。`cocos_2x_operation_preview_accept` 将单独的视觉证据追加到已有运行态 preview 回执，`operation.get` 返回 `completed`。用 MCP 补偿和重放两轮后，补偿记录的 capability/editor/disk/recovery 均通过，preview 为 `skipped`；`operation.get` 与 `scene.node.inspect` 分别返回 `completed` 和 `not-found`，刷新预览恢复到原始 Hello World 画面。Creator 保存时重排了 `.fire` 序列化字段，测试后已把示例场景恢复为提交版本；当前 MCP 实测未留下场景差异。该轮还修复了补偿型 `scene.node.create` 被错误报告为 `needs-preview` 的状态判断，并为运行态与视觉双证据追加行为增加回归测试。随后用临时合成的“不确定写入”记录经 MCP 调用 `operation.reconcile`；真实 Creator 活动场景与磁盘均确认目标缺席，返回 `WRITE_RECONCILED_NO_EFFECT`、`sideEffect=none`、`recovery=passed`。合成记录在验收后删除；这证明 MCP 接线及真实双侧读回，不代表经历了真实编辑器故障。经 MCP 完成 `content.build.plan/execute/get`，构建 ID `web-mcp-real-01` 的隔离包状态依次为 `ready/verified/completed`，校验了红蓝两张资源的 UUID、pack import JSON 与 native PNG；随后同一构建又经 MCP 完成 `content.preview.start/get/stop`。浏览器实际显示蓝色方块、Cocos logo 和 Hello World，`get` 返回 `runtime-observed`，运行时回执确认蓝色资源已应用且引用计数为 1；预览服务和浏览器标签均已关闭。预览 URL 中的短期访问 token 未写入轨迹。最后，使用短期 synthetic `running` 构建记录（引用上面的已验证输出，不模拟真实 Creator 崩溃）通过 MCP `content.build.reconcile` 得到 `verified`，随后 `get` 读回 `completed`，重复 reconcile 返回 `already-terminal`；临时记录已删除。这验证了 MCP stdio 路由和恢复结果幂等，不替代真实 Host 崩溃后的进程恢复测试。证据见 [MCP 实机轨迹](traces/cocos-agent-mcp-2.4.jsonl)；构建执行的既有 JSONL/Host 实机证据仍见内容构建合同。

本轮新增 12 个资源流水线和内容 release MCP 工具，InMemoryTransport 测试已验证工具发现、专属 schema、固定 2.4 目标映射及全部方法到 JSONL 的路由。另通过真实 MCP stdio 与隔离临时工程验证 `content.get/select/rollback`：红、蓝测试 release 依次选择；错误的旧 `expectedCurrent` 返回 `CURRENT_CHANGED`；rollback 选回红版，随后清理整个 fixture。此前曾因锁屏使真实 `instances.list` 返回 `CATALOG_FAILED`（轨迹第 38 条）；解锁后 Host 精确选中 `2.4.15NewProject` 的 `helloworld` 实例，3.8 工程仍为 disconnected。之后经 MCP 成功预检并由 AssetDB 导入两张临时 PNG，读取 Texture/SpriteFrame UUID 与 `.meta`；第一张 Sprite 的场景写入和磁盘读回通过。两项 `assets.scene.execute` 请求超过 MCP Client 的默认等待时间，断开后第一节点存在、第二节点在活动场景和 `.fire` 中均不存在且没有操作记录。为此修复 `scene.sprites` 的恢复分支：缺少操作记录时，只有在同一实例/Canvas、资源 SHA 与 UUID、活动场景精确节点缺席、序列化场景父身份匹配且目标子节点缺席都通过后，才记录 `WRITE_RECONCILED_NO_EFFECT`；此分支把该项标为 rejected，不自动重发写入。之后经 MCP 补偿撤销第一节点、删除两份 PNG 和 `.meta`，恢复读回将流水线结为 `compensated` / `rollbackStatus=passed`；再次查询确认两个节点均为 `not-found`，资源与元数据均不存在，`helloworld.fire` 已按测试前 SHA-256 恢复。当前 MCP 路径尚未取得该场景的有效预览画面，因此没有调用 `assets_scene_preview_accept`，也没有执行 `content.fromScene.plan/stage`；完整预览验收仍待后续一轮。预览截图本轮显示空画布，不能写成已通过视觉验收。当时尚未提供的 MCP Resource/Prompt 与资源场景执行进度已在后续切片补齐；取消、跨进程重连恢复和远程 HTTP transport 仍未实现。当前首版不改 Creator 扩展代码；后续可按面试目标继续沉淀经验证的 2.x 能力，再制定 3.x 适配计划。

上述超时后新增的资源场景进度与合作取消切片已通过自动测试：opt-in progress token 可收到带命令名的通知；同项目重复 execute 会被阻止，回执仍可查询；明确取消会设置共享标记，模拟验收覆盖写入场景节点后补偿节点与资源、以及导入中途停止并清理已导入资源。Worker 消息通道另通过无编辑器副作用的请求测试。此自动验收没有对 Creator 执行资源导入或场景写入；因此不构成真实 MCP 写入/预览验收，也不证明客户端一定延长超时。

2026-10-09 又通过 MCP 官方 SDK `StdioClientTransport` 在真实 Creator 2.4.15 中完成了进度、协作取消与补偿验收：Host 精确选中 `2.4.15NewProject` 的 `helloworld` 实例；两张 RGBA PNG 计划成功；收到逐 Host 命令进度；第一张 AssetDB 导入和 UUID 读回通过；取消请求被接受；第二张导入在下一写入边界以 `sideEffect=none` 拒绝；第一张资源经 `asset.removeImportedPng` 删除并由磁盘读回确认。父流水线终态为 `failed/EXECUTION_CANCELLED`、`rollbackStatus=passed`，两个节点均 `not-found`，资源目录无残留。另以隔离的单张 RGBA 图片验证 AssetDB 导入与受校验删除命令可各自成功。

失败边界也有实机证据：灰度/透明 PNG 测试夹具触发 2.4 导入失败，AssetDB 留下宽高为零、无 SpriteFrame 子 UUID 的不完整 `.meta`；流水线返回 `needs-review/IMPORT_OUTCOME_UNCERTAIN` 并阻止自动删除，场景未写入。测试后按精确文件摘要、元数据 UUID 和完整无引用扫描移除了这两个专属临时文件。该结果不应外推为 Creator 对所有灰度 PNG 的限制；它记录的是该夹具与当前编辑器的导入结果。完整进度、取消、回滚及失败清理边界见 [`MCP 取消实机轨迹`](traces/cocos-agent-mcp-cancel-2.4.jsonl)。

后续只读诊断确认 2.4 Creator 的活动场景不是空场景：`scene.snapshot` 读回 `helloworld` 下 12 个节点，包括 Canvas、Main Camera、background、cocos 与 label。7456 预览服务返回 HTTP 200，`settings.js` 指向 `db://assets/Scene/helloworld.fire`，quick-compile 与预览引擎脚本也均返回 200。Mac 当前再次锁屏；为区分页面启动问题，在隔离 Chrome headless + SwiftShader 中打开同一 URL，脚本编译并打印 `Cocos Creator v2.4.15`，但截图停在 splash，控制台伴随 `CVDisplayLinkCreateWithCGDisplay` 错误。该 headless 结果不能代表实际桌面浏览器，不能用作预览验收；还需要在解锁桌面后读取实际浏览器运行状态/控制台，再决定是否调用 `assets_scene_preview_accept`。诊断轨迹为第 50–52 条。
