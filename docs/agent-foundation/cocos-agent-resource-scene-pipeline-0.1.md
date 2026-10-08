# Creator 2.4 资源到场景流水线 0.1

接口结构见 [`asset-scene-pipeline.schema.json`](../../tools/cocos-agent-bridge/asset-scene-pipeline.schema.json)。`assets.scene.*` 是 Host 端编排，只支持 Cocos Creator **2.4.15** 和 PNG SpriteFrame；它复用版本专属扩展的导入、场景写入与 AssetDB 删除合同，不添加任意脚本或任意路径执行能力。3.8.7 目录不声明这组能力。

## 流程与不变量

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
