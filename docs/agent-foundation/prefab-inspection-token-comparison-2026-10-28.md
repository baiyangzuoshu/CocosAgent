# UIMain Prefab 检查路径与 Token 输出规模对比

日期：2026-10-28

工程：`F:\merge-client-new\mergeClient`，Cocos Creator 2.4.15

资源：`assets/BundleDWCSZ/GUI/UIMain.prefab`，AssetDB UUID `10743041-a6fa-4ec0-85db-b2d24be42a9d`

## 结论

- 对完整 172 节点结果，直接把 `.prefab` 原文交给模型约为 **95,884 个工具估算 token**；CLI 两页完整结构化输出合计约 **159,117 个工具估算 token**，比原文多约 **66%**。因此，全量 CLI 结果不天然省 token，也不应默认把两页完整 JSON 全部塞进模型上下文。
- 若 Codex 在本机先把两种来源归纳成相同的节点/组件摘要，直接解析为 **179**，CLI 分页后本机汇总为 **180** 个工具估算 token，基本相同。token 节省主要来自本地过滤/汇总，而不是数据来源本身。
- 对已知单节点 `map` 使用 CLI 的 `nodeUuid` 精确查询，完整响应约 **1,885 个工具估算 token**，比把整个 Prefab 原文交给模型少约 **98%**。CLI 在按节点缩小范围、绑定 AssetDB 身份和校验源哈希方面有明显优势。
- 两种方式得到的 UIMain 摘要一致：172 个节点、根节点 11 个直接子节点、分支节点数和普通组件统计一致。CLI 另提供每节点 `cc.PrefabInfo`、节点 UUID/路径、组件字段摘要、分页和源哈希；本次 172/172 个节点都有 `cc.PrefabInfo`，组件列表无截断，两页源哈希相同。

## 计量口径

当前 Codex 工具没有提供单任务的 GPT-6 精确输入 token 账单。以下数字取自 `exec_command.original_token_count`，该字段是工具对命令标准输出的**近似 token 数**，不是模型侧精确 token 用量，也不包含系统提示、推理 token 或回复 token。

全量输出规模通过工具的原始输出计数取得；为避免把近 16 万 token 的 Prefab JSON 实际灌入本次上下文，测量调用将可见输出限制为 200 token，但记录其截断前的 `original_token_count`。紧凑摘要则完整输出，并以相同字段比较。

## 数值

| 路径 | 范围 | 工具估算 token | 说明 |
| --- | --- | ---: | --- |
| 直接读取文件 | 完整 `.prefab` 原文 | 95,884 | 文件大小 383,532 字节；完整序列化对象 527 个 |
| CLI `offset=0, limit=100` | 第 1 页 | 89,926 | 返回 100 个节点 |
| CLI `offset=100, limit=100` | 第 2 页 | 69,191 | 返回 72 个节点 |
| CLI 完整分页合计 | 172 个节点 | 159,117 | 比直接原文输出规模多 63,233，约 +66% |
| 直接解析后本机输出摘要 | 与 CLI 相同的节点/组件摘要 | 179 | 根节点、11 个分支、组件数、PrefabInfo 数 |
| CLI 分页后本机输出相同摘要 | 与直接解析相同的信息 | 180 | 比直接摘要多 1，约 +0.6% |
| CLI 精确查询 `map` 节点 | 单节点 | 1,885 | 带该节点身份、组件摘要、`cc.PrefabInfo` 和有界子树信息 |

单节点结果与全文件结果范围不同；98% 的对比说明 CLI 可以避免为单节点问题向模型提供整份 Prefab，不表示同范围的直接解析一定更贵。若 Codex 自行编写本机解析脚本并只输出同一节点摘要，也能把模型侧文本压得很小。

## 结构结果核对

两种方法的根节点和分支统计：

| 根节点直接子分支 | 含该分支自身的节点数 |
| --- | ---: |
| `New Sprite(Splash)` | 1 |
| `map` | 8 |
| `bottom` | 71 |
| `topRight` | 2 |
| `top` | 64 |
| `topLeft` | 5 |
| `control` | 5 |
| `buyBuild` | 4 |
| `uiMask` | 1 |
| `test` | 9 |
| `renderRect` | 1 |

普通组件数量一致：`cc.Sprite` 101、`cc.LabelSDF` 38、`cc.Button` 33、`cc.Layout` 4、`cc.Mask` 3、`cc.ScrollView` 2、`cc.BlockInputEvents` 1，共 182 个。原始序列化另含 172 个 `cc.PrefabInfo` 和一个 `cc.Prefab` 对象；CLI 将 PrefabInfo 单独返回，不计入 `componentCount`。

CLI 两页的 `sourceSha256` 均为 `9f93a632474bc87bc966e18251651cbc483a44bf1e2a39802a1b7e6f7d6e4d40`。

## 使用建议

- 要概览整份 Prefab：优先让 CLI/本机解析器先汇总节点、分支和组件，再将紧凑摘要交给模型；完整 CLI 节点 JSON 更详细，但输出规模更大。
- 要定位一个已知节点：用 CLI 的 `nodeUuid` 精确查询，避免全量分页。
- 要检查 CLI 未建模的原始字段：回读 `.prefab` 原始序列化数据，并将原文分析结果与 CLI 的 AssetDB UUID、源哈希核对。
