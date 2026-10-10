# Creator 2.4 资源到场景流水线 0.1

接口结构见 [`asset-scene-pipeline.schema.json`](../../tools/cocos-agent-bridge/asset-scene-pipeline.schema.json)。`assets.scene.*` 是 Host 端编排，只支持 Cocos Creator **2.4.15** 和 PNG SpriteFrame；它复用版本专属扩展的导入、场景写入与 AssetDB 删除合同，不添加任意脚本或任意路径执行能力。3.8.7 目录不声明这组能力。

## 流程与不变量

只读校验与安全修复
----------------

assets.scene.validate 对指定流水线的一个或全部资源执行只读交叉核验：磁盘 PNG 的 SHA-256、签名和 IHDR 尺寸；Texture 与唯一 SpriteFrame 子资源的 .meta UUID 链；Creator AssetDB URL 到 Texture UUID 的映射；当前 Creator 实例/活动场景里的 SpriteFrame 引用；场景 .fire 中节点与 Canvas 父子关系；以及场景批次的已应用记录。每项返回 valid、repairable 或 needs-review，并携带逐项检查与问题代码。它不会保存场景或修改文件。

assets.scene.repair 仅接受本流水线管理、仍被场景引用且处于 needs-preview 或 completed 的资源。只有本地 PNG 摘要/尺寸、.meta UUID、运行时引用、序列化场景引用和批次身份全部匹配，且唯一问题是 ASSETDB_MAPPING_STALE 时，才请求 Creator 2.4 的 Editor.assetdb.refresh(url, callback)。扩展和 Host 分别读回 AssetDB 映射、磁盘元数据、UUID 与场景引用；若 Creator 报告 uuid-change、身份变化或刷新错误，结果进入 needs-review。修复尝试在父流水线记录中按 repairId 持久化；进程中断后重试会先重新校验，若前一次刷新已生效则对账，不会重复刷新。已有效资源返回 already-valid。

修复不编辑、不重建 .meta，不手工分配 UUID，也不把一般导入错误转换成自动修复。官方手册指出资源文件与 AssetDB 不一致时应使用 AssetDB 的刷新 API 同步；.meta 由 AssetDB 管理，必须保留其中的 UUID 身份：[AssetDB 主进程 API](https://docs.cocos.com/creator/2.4/manual/en/extension/api/asset-db/asset-db-main.html)、[管理项目资源](https://docs.cocos.com/creator/2.4/manual/zh/extension/asset-management.html)、[Meta Reference](https://docs.cocos.com/creator/2.4/manual/zh/extension/reference/meta-reference.html)。

`assets.scene.plan` 是只读预检：检查 2–16 个绝对 PNG 路径、PNG IHDR 与大小/尺寸限制、文件名及目标资源冲突、精确项目/版本、当前活动场景、唯一 Canvas 和拟创建节点名。资源尚未导入时，预检不会伪造 `.meta` 或 UUID。

`assets.scene.execute` 首先在项目 `.cocos-agent/asset-scene-pipelines/<pipelineId>.json` 持久化父记录，再调用既有 `assets.batch.execute`。每个导入项都要通过源摘要、Creator AssetDB 导入回执、资源磁盘读回和 `.meta` 验证；2.4 的身份链为主纹理 UUID → 唯一 SpriteFrame 子资源 UUID，且 SpriteFrame 的 `rawTextureUuid` 必须回指主纹理。通过后才调用 `scene.sprites.execute`，在同一活动场景的 Canvas 下引用对应 SpriteFrame，并逐项核对场景磁盘读回。

操作中的关键约束如下：

- 不覆盖已存在的目标文件，不手工生成或改写 Creator `.meta`，不自行产生 UUID。
- 每张图有独立场景 `operationId`；场景操作仍要求磁盘读回和本次预览验收。
- 父流水线记录与导入批次、场景批次和单项操作记录分开持久化。执行不是文件系统事务；恢复时必须按记录对账，不能将重放等同于安全重试。
- 已导入资源只在 `textureUuid`、`spriteFrameUuid`、源 SHA-256 与磁盘 `.meta` 全部匹配时才可进入清理阶段。

| 流水线结果 | 含义 |
| --- | --- |
| `ready` | 只读计划通过，尚未导入或写场景。 |
| `needs-preview` | PNG 已导入、UUID 关系已校验、场景已保存并读回；每项仍需观察对应 Web 预览。 |
| `completed` | 每个场景操作都已记录本次预览通过。 |
| `failed` + `rollbackStatus=passed` | 发生可确认的失败；场景引用和本流水线已确认导入的资源都已按顺序撤销。 |
| `compensated` | 显式补偿完成；先撤销场景引用，再移除导入资源。 |
| `needs-review` | 导入、场景写入、身份或清理结果不确定；停止自动删除，检查父记录、子批次、单项操作、场景与 AssetDB。 |

验证与修复结果为独立调用回执，不会把父流水线 needs-preview 自动改为 completed，也不代替真实 Web 预览回执。assets.scene.get 会返回持久化的 repairAttempts，便于进程重启后检查尝试状态。

确定的部分导入失败会清理此前已确认由此批次导入的资源。场景写入发生确定失败时，先让场景批次逆序补偿，再清理资源。显式 `assets.scene.compensate` 也采用相同次序。对于不确定导入身份、场景副作用或删除回执，不猜测副作用归属，也不继续删除。

删除前 Host 会重新读取源文件和 `.meta`、核对 UUID 与 SHA-256，并在项目 `assets/` 下扫描目标纹理/SpriteFrame UUID 的序列化引用；发现引用、符号链接、扫描上限或不可读文件时拒绝删除。Creator 扩展再确认 AssetDB URL 仍映射到同一主纹理 UUID，通过 `Editor.assetdb.delete` 删除，并核对 AssetDB 和文件读回。官方 2.4 扩展文档指出，独立删改资源文件会破坏 AssetDB 与 `.meta` 一致性，应该走专用 AssetDB API；本实现遵循该合同：[AssetDB 主进程 API](https://docs.cocos.com/creator/2.4/manual/en/extension/api/asset-db/asset-db-main.html)、[管理项目资源](https://docs.cocos.com/creator/2.4/manual/en/extension/asset-management.html)。

若 Creator 已删除 PNG 与 `.meta` 但回执未通过 Host 校验，流水线只有在场景批次已补偿、磁盘文件缺失且 `assets/` 内 UUID 引用扫描完整通过后，才按读回证据完成回滚；否则保留 `needs-review`。

静态扫描不能识别运行时拼接的 UUID 或项目外部引用，因此它不是通用依赖图；任何发现不完整的情况都应按 `needs-review` 处理。此流程只用于本 Agent 记录并生成的资源，不能作为任意项目资产清理工具。

## JSONL 调用示例

先计划，再使用返回的 `pipelineId` 执行。`positions` 与 `sources` 按索引配对；省略时默认 `(0,0)`，多张图片会重叠，实际任务建议给出位置。Sprite 默认 1 倍缩放，显示资源原始像素尺寸。

```json
{"id":1,"method":"assets.scene.plan","params":{"targets":[{"creatorVersion":"2.4.15","projectRoot":"/abs/path/2.4.15NewProject"}],"projectRoot":"/abs/path/2.4.15NewProject","creatorVersion":"2.4.15","sources":["/abs/path/red.png","/abs/path/blue.png"],"positions":[{"x":-64,"y":0},{"x":64,"y":0}]}}
{"id":2,"method":"assets.scene.execute","params":{"targets":[{"creatorVersion":"2.4.15","projectRoot":"/abs/path/2.4.15NewProject"}],"projectRoot":"/abs/path/2.4.15NewProject","creatorVersion":"2.4.15","pipelineId":"<plan-returned-UUID>","sources":["/abs/path/red.png","/abs/path/blue.png"],"positions":[{"x":-64,"y":0},{"x":64,"y":0}]}}
```

执行返回每项 `operationId`。在 Creator 2.4 Web 预览中观察本次场景，之后逐项调用 `assets.scene.preview.accept`，传实际 loopback 预览 URL、观察时间和可见结果说明。所有项预览通过后，`assets.scene.get` 返回 `completed`。若要撤销已完成或等待预览的流水线，调用 `assets.scene.compensate`；只有确认场景引用删除后才会调用资产删除。

## 验收边界

模拟测试覆盖计划与输入拒绝、Meta/UUID 读回、完整导入和场景引用、逐项预览、显式补偿、第二项导入失败后的资产回滚、场景拒绝后的节点回滚与资源清理，以及不一致元数据时 fail-closed。Creator 实机结果需另记在本文件的验收补充和 `docs/agent-foundation/traces/`；模拟通过不能标记真实 AssetDB 删除、编辑器场景重开或预览为已验证。

### 2.4.15 Creator 实机验收（2026-10-08）

在 `2.4.15NewProject` 的 `helloworld` 场景，以本机生成的两张 128×128 PNG 完成整条流程。AssetDB 为 Red/Blue 分别创建 Texture UUID `757c47c6-124b-4069-b2ad-122e0541baa4` / `1349bc3b-3d87-4df1-a859-34eddbd344f0`，以及 SpriteFrame UUID `9e8b7eee-98c0-43e8-a76d-6821ab3d30eb` / `245fbe48-ea13-4a92-be64-e9da159934bc`；两份 `.meta` 的 `rawTextureUuid` 都回指对应 Texture。场景中的两个 Canvas 子节点引用各自 SpriteFrame，位于 `(-90,0)` 和 `(90,0)`，缩放为 `(1,1,1)`。执行后磁盘 `.fire` 读回通过；Creator 重开 `helloworld.fire` 后，节点、Sprite 组件、UUID 与坐标仍匹配。Web 预览中 Hello World 两侧的红蓝方块均清晰可见，两个单项 `preview.accept` 均通过。

随后显式补偿先撤销两个场景节点，再请求 AssetDB 删除。Blue 删除回执一度为 `sideEffect=possible`，首次调用正确返回 `needs-review` 并暂停；现场读回确认两个 PNG 与 `.meta` 均不存在，场景批次已补偿，`assets/` UUID 引用扫描完整且无引用。再次显式调用 `assets.scene.compensate` 后，流水线以 `asset-absence-and-reference-scan` 证据对账为 `compensated` / `rollbackStatus=passed`。最后刷新 Web 预览确认恢复原始 Hello World 画面；`helloworld.fire` 恢复为测试前 SHA-256 `0963cd0a52e25cdfa3edda47a6e998053885d2b93753da7a5c0da2562728d1a8`，测试 PNG 和 `.meta` 均已清除。完整 UUID、批次 ID 和持久化终态见 [`cocos-agent-resource-scene-pipeline-2.4-web.jsonl`](traces/cocos-agent-resource-scene-pipeline-2.4-web.jsonl)。

这次实机验证覆盖 Creator 2.4.15、当前本机 Web 预览与普通 PNG Sprite；不代表 3.8、原生运行时、其他导入类型、运行时动态 UUID 依赖或任意用户资源删除已验证。模拟测试仍负责覆盖确定失败和元数据不一致分支。

### 2.4.15 资源校验与修复实机验收（2026-10-08）

在 Creator 2.4.15 的 `helloworld` 活动场景中，另一条双 PNG 流水线执行 `assets.scene.validate`，Red 与 Blue 均为 `valid`：PNG 摘要/尺寸、Texture/SpriteFrame `.meta` UUID 链、AssetDB URL 映射、活动场景 Sprite、`.fire` Canvas 父子关系和场景批次记录全部通过。随后调用 `assets.scene.repair`，结果为 `already-valid`，并将 repairId 与尝试状态写入父记录；此路径没有触发 AssetDB 刷新。最后显式补偿成功，两个 PNG 与 `.meta` 均由 AssetDB 删除，场景批次撤销通过。完整实例、流水线、批次、资源 UUID、校验结果和清理状态见 [`cocos-agent-resource-scene-validation-2.4-web.jsonl`](traces/cocos-agent-resource-scene-validation-2.4-web.jsonl)。

这次运行没有诱发陈旧 URL→UUID 映射，因此真实 `Editor.assetdb.refresh` 修复分支尚未在 Creator 中验证；该分支目前只有模拟测试覆盖。Creator 保存场景时会规范化 `.fire` 中与本次操作无关的序列化字段。本次补偿后将测试场景文件按测试前 Git 基线字节恢复，并确认测试 PNG 与 `.meta` 已删除；这说明场景文件字节恢复是单独的测试清理动作，不应误记为场景批次补偿自身恢复了原始文件字节。

### Agent 编排资源导入、场景写入、预览与补偿（2026-10-09）

使用 `cocos-agent-2x` MCP 工具的 Codex Agent 先查询实例和能力目录，选中 Creator 2.4.15 的 `helloworld` 项目及现有 Canvas，再对用户明确给定的两张 64×64 临时 RGBA PNG 执行计划。计划输出源 SHA-256、PNG IHDR 尺寸、目标资源名、Canvas 坐标和冲突检查；随后一次性执行 `assets.scene.execute`，没有在结果不确定时重试写入。

两张 PNG 分别导入为 Texture UUID `d370f2d9-1550-4f1d-9be5-99b5b4a4bb59` / `d2821d7b-f26d-4b67-b0f5-44f2460e234c`，并生成 SpriteFrame UUID `d55b8e0e-d2a7-4b0e-8517-ef854bf09e55` / `91ed058f-0b21-4287-ba04-60920985ff1a`。Agent 核对两份 `.meta` 的 `rawTextureUuid` 均回指各自 Texture，AssetDB URL 映射、源摘要和尺寸有效；随后将 SpriteFrame 分别挂到 Canvas 的 `(-160,0)`、`(160,0)`，并通过活动场景和 `helloworld.fire` 磁盘读回。`assets.scene.validate` 在预览前后均为 `valid`，覆盖 PNG 字节、Texture/SpriteFrame UUID 链、AssetDB、活动与序列化场景引用及批次记录。

Creator Web 预览 `http://127.0.0.1:7456/` 中红、青两张临时图片都在目标位置可见；两项 `preview.accept` 成功，流水线进入 `completed`。随后显式补偿的首个调用因青色资源删除回执不确定而进入 `needs-review`，没有继续盲目删除。读回确认两个 PNG 与 `.meta` 均缺失、场景引用和序列化 UUID 扫描无残留后，再调用补偿进行 `asset-absence-and-reference-scan` 对账，最终 `compensated`、`rollbackStatus=passed`。随后只读 `asset.searchPng` 对两个精确文件名均返回 `total=0`，场景快照没有对应临时节点；刷新预览后恢复基线画面。`helloworld.fire` SHA-256 与测试前一致，为 `0cdc7dd5424e2c4414f6b58caff1cd74142f77a7caaa075df08df280d7a4df94`；临时源 PNG 也已删除。流水线、资源批次和场景批次 ID、具体回执见[本次 Agent 端到端轨迹](traces/cocos-agent-resource-scene-agent-2.4-web.jsonl)。

本次闭环验证的是 Creator 2.4.15 Web 下 PNG → Texture → SpriteFrame → Canvas Sprite 的正式导入、元数据关系、静态场景依赖与 Agent 编排；不代表其他图片/音频/模型格式、Asset Bundle 动态共享依赖、运行时拼接依赖或原生构建。自动修复能力仍只允许对身份保持不变且唯一问题为 `ASSETDB_MAPPING_STALE` 的资源调用 AssetDB refresh。真实修复分支仍未验证：10 月 10 日故障注入生成了同时存在运行时引用缺失的状态，触发了正确拒绝；`already-valid` 只验证无副作用分支。

### 取消与导入失败的 2.4.15 实机验收（2026-10-09）

真实 MCP stdio 客户端在 `helloworld` 场景计划两张 1×1 RGBA PNG。收到 `asset.importPng` 开始通知后请求取消；第一张已完成并通过 UUID/meta 读回，第二张在下一写入边界被拒绝且 `sideEffect=none`。流水线随后调用 `asset.removeImportedPng` 清除第一张资源，终态为 `failed/EXECUTION_CANCELLED`、`rollbackStatus=passed`。两个目标场景节点均为 `not-found`，两张 PNG 和 `.meta` 均不存在。单张 PNG 的 AssetDB 导入和删除也分别独立通过。

一次较早的灰度/透明 PNG 夹具导入失败并留下宽高为零、无 SpriteFrame 子资源的不完整 `.meta`。父流水线按设计进入 `needs-review`，未将不确定导入误报为无副作用，也未自动删除；随后仅在确认测试文件摘要、UUID 与工程内无序列化引用后清除该临时文件及 `.meta`。此例说明失败补偿的安全边界，不证明 Creator 普遍不支持灰度 PNG。逐条回执见 [`cocos-agent-mcp-cancel-2.4.jsonl`](traces/cocos-agent-mcp-cancel-2.4.jsonl)。

### 2026-10-10：尝试在 Creator 中诱发陈旧 AssetDB 映射

临时流水线 `0083bc3f-d607-402b-804d-e6506df64fe9` 使用 `RepairRedA20261010.png` 和 `AssetBlueB20261010.png`。为制造故障，将红图和 `.meta` 移出 `assets/resources`，再让 Creator 刷新该目录。AssetDB 删除红图 UUID 映射后，活动 SpriteFrame 引用也变成空值。恢复原字节后，校验同时报告 `ASSETDB_MAPPING_STALE` 与 `SCENE_RUNTIME_REFERENCE_MISMATCH`，因此 `assets.scene.repair` 按合同拒绝刷新；这不是可修复的“只有 URL 映射陈旧”状态。

随后刷新 `resources` 目录，AssetDB 以相同 Texture UUID `01069f45-7316-4b69-9ee8-06424c99db4b` 和 SpriteFrame UUID `e80b2ec0-d2c0-4940-8231-997739ac5f31` 重建映射，未发生 UUID 漂移；但活动场景引用仍为空。通过受限 `scene.node.patch` 恢复原 SpriteFrame UUID 后，PNG 字节、`.meta`、AssetDB、活动场景与 `.fire` 引用均读回匹配。此时资源校验唯一失败项为 `SCENE_BATCH_REFERENCE_MISMATCH`：子场景批次仍把红项记在 `compensating`，因为先前一次补偿预检在资源暂缺期间以 `SCENE_NODE_CONFLICT/sideEffect=none` 拒绝。

流水线现为 `needs-review`、`rollbackStatus=blocked`。另一个新 operation ID 的直接补偿请求被自动审批拒绝，理由是这会绕过 needs-review 批次账本；没有通过其他通道执行该删除。Creator 重启后，Host 已登记新实例 `4ca661b3-4391-4639-811e-89363788d60f`，而流水线记录仍绑定旧实例 `fa689b2c-2faf-405a-a6ff-f0a90d749adf`。只读核对确认红节点在新活动场景和 `.fire` 中仍存在，Blue 节点已补偿；两张 PNG 与 `.meta` 均在。场景 SHA-256 为 `5773772cb2423c5a98acfe14e8ee6659b05c731952c4252c8e3f5617d528719c`，测试前为 `0cdc7dd5424e2c4414f6b58caff1cd74142f77a7caaa075df08df280d7a4df94`。为通过原批次入口安全恢复，恢复实现现在还要求核对重启后相同的项目、版本、活动场景和 Canvas UUID，以及红节点 UUID、唯一 Sprite 组件、SpriteFrame UUID、变换、PNG 摘要和序列化内容；全部吻合后才记入新旧实例 ID 并继续原流水线补偿。14 项场景批次模拟测试及 8 项父流水线测试通过，包括 Canvas、实时 SpriteFrame、磁盘变换漂移时拒绝补偿。**此恢复分支尚未在 Creator 重启后的真实 MCP Host 上运行；临时节点和两份导入资源目前仍在项目中。** 需要 MCP Host 加载这版实现后，再调用原 `assets.scene.compensate` 并读回批次、资源目录和场景文件，不能把模拟测试当作真实清理成功。逐步读回见 [`修复分支尝试轨迹`](traces/cocos-agent-resource-repair-attempt-2.4-web.jsonl)。
