# Creator 2.4.15 通用项目开发工具合同 0.1

日期：2026-10-17。状态：**M1 合同已定义；只读 `project.search` 与既有脚本单文件 0.2（JS/TS）源码桥接已接入；新增/多文件脚本、通用组件属性、通用资源引用及事件绑定写入仍待实现。所有本轮新增路径都待 Creator 原生面板验收。** 本合同只针对 Creator 2.4.15，不暗示 3.8 支持。

## 目标与安全边界

把工程内常见开发动作做成可组合、按 Creator 工程注册和发现的命令，不提供 shell、任意系统文件访问或绕过 Creator 的场景/Prefab/资源写入。项目文件限 `assets/` 下允许的游戏源文件；场景、Prefab、资源元数据及序列化引用通过 Creator AssetDB/Scene API 操作。

所有命令必须经当前已注册的绝对工程路径与 Creator 实例；回执带 `contractVersion`、`creatorVersion`、`projectRoot`、`instanceId` 和请求 nonce。2.4.15 是唯一可用版本。输入严格拒绝未知字段、绝对路径、`..`、符号链接、超限数据和路径规范化逃逸。读操作有分页/字节上限。写操作需要当前写入审批，并校验实时身份及 before 哈希/值；每个目标的副作用与结果单独记账，不声称多文件原子事务。

## 命令合同

| 命令 | 访问 | 输入与输出要点 |
| --- | --- | --- |
| `project.search` | read | 在 `assets/` 树内工程相对查询；`scope=code/assets/all`、偏移与上限。扫描最多 20,000 个文件、目录深度 14；代码仅 JS/TS，单文件内容最多 256 KiB、累计最多 50 MiB，结果每页最多 50 项，代码命中最多 3 条 400 字符摘要。单文件不超过 5 MiB 时提供源 SHA-256；资源元数据提供可用 UUID/importer/meta 哈希。已导入 PNG 仍可用 `asset.searchPng` 获得 AssetDB 核验。结果分页仅覆盖本轮已扫描到的命中；超出扫描边界以 `truncated` 标记，不暗示存在可继续扫描的游标。 |
| `script.files.read` | read | 1–16 个 `assets/` 相对 `.js`/`.ts` 路径；逐文件返回 importer、UUID、源/meta 哈希及有界 UTF-8 源码。 |
| `script.files.plan` | read | 逐文件 `create` 或 `replace`；replace 要求 UUID 与 `expectedSha256`，create 要求目标明确不存在。返回精确逐文件差异、候选哈希、导入器类型和依赖提示，不写入。 |
| `script.files.apply` | write | `apply/compensate/reconcile/replay`、operation ID、经批准的计划摘要和目标集合。逐项写入/AssetDB 导入/读回；回执按文件列明 before/after 哈希、UUID/meta 状态、导入/编译状态与副作用。部分成功停在 `needs-review`，不自动重放；补偿只在当前仍精确等于本 operation 的候选哈希时执行。 |
| `scene.component.inspect` | read | 活动场景、节点 UUID、组件 UUID/类型；返回 Creator 序列化可保存的属性 schema、当前值及可编辑/不可编辑原因。 |
| `scene.component.patch.plan` | read | 精确节点/组件身份、字段路径、before/after 值。只接受 Creator 类型元数据允许且本合同登记的字段；资源值用 UUID，并验证 AssetDB 类型与引用。 |
| `scene.component.patch` | write | operation ID、节点/组件身份、精确差异及 `apply/compensate/reconcile/replay`；写入后核对编辑器实时值及保存场景序列化读回。 |
| `scene.event.inspect` | read | 指定节点/组件的序列化事件数组；返回 target UUID、component UUID、handler、custom data 和事件顺序。 |
| `scene.event.patch.plan` | read | 精确事件 before/after；target 和组件须在当前场景中解析，handler 必须存在于目标脚本可识别的 public component method 列表。 |
| `scene.event.patch` | write | 按事件项添加/删除/替换；写前校验场景、节点、组件、脚本和事件身份，保存后逐字段读回；恢复只逆转本 operation 创建/删除的精确项，冲突时拒绝。 |

脚本新建和更改仍是项目内容写入，不赋予任意代码执行能力。Creator 的 JS/TS 编译回执必须与每个精确源哈希关联；TS 编译若在当前 2.4.15 安装中不能确认，则报告 `not-verified` 并停止该项成功判定。组件字段反射不等于所有自定义字段均可写；未知类型、编辑器仅有临时态或不能序列化读回的字段必须作为 `unsupported` 返回。

## Creator 接入与状态

遵循“合同 → Creator 扩展桥接 → MCP/Agent 能力发现 → 产品 skill → 原生面板验收”。Catalog 只报告真实存在的合同；版本、schema、访问级别或预条件不匹配时 Host 将能力降为 unavailable。

| 能力 | 合同 | Creator 桥接 | skill | Creator 原生验收 |
| --- | --- | --- | --- | --- |
| `project.search` | 已定义 | Creator 扩展/MCP 源码已接入只读 JS/TS 内容与 assets 文件名/元数据查询；PNG AssetDB 搜索保留原命令 | 已发布到产品源包 | 待打包安装及原生面板验收 |
| 既有 `script.*` 0.2 单文件编辑 | 扩展合同 0.2 | Creator 扩展与 MCP schema 已允许 JS/TS importer；TS 计划明确不做 Node 语法解析，要求 Creator 精确编译产物 | 已更新既有 skill | JS 既有证据可参考；本次 TS 分支待原生验收 |
| `script.files.*` 新建/多文件 | 已定义 | 待实现；单文件 `script.*` 0.2 不等于文件组事务 | 待发布 | 待验收 |
| `scene.component.*` | 已定义 | 待实现 | 待发布 | 待验收 |
| `scene.event.*` | 已定义 | 待实现 | 待发布 | 待验收 |

现有 `script.read/script.patch`、`asset.searchPng`、`scene.node.create/patch` 仍按各自合同单独发现；它们不自动升级为本合同的多文件、任意组件属性或事件能力。

## 首个真实样本的使用范围

首个小范围真实任务候选是检查 LinkUpClient 分享提示入口的 `realShare` 参数在 UI action、分享回调和奖励请求之间的传递；已知目标是既有 TypeScript 控制器，但本工作区没有 LinkUpClient 工程，当前 Creator 也尚未提供该实例，因此目标路径、实现约定、现有改动和基线哈希均未确认。**成功条件：** 从当前 Creator 搜索并精确重读目标脚本，沿调用方确认预期参数；如确有不一致，只提交一处经批准的最小差异，Creator 编译回执绑定候选源哈希，操作记录、源读回和 UUID/meta 身份一致。真实小程序分享回调与服务端奖励结果单独标为未验收，不能用编译成功代替。**恢复基线：** 写前记录源 SHA-256、meta SHA-256、脚本 UUID、工程约定哈希和未决操作；仅可通过同一 operation 进行对账或精确补偿，发现用户后续编辑或身份变化则停止。源码/schema/skill 接线不代表 Creator 已安装此版本，也不代表该业务任务已执行；本轮没有改动 LinkUpClient。
