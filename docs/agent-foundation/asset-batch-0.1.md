# 批量 PNG 导入 0.1

计划输入结构见 `tools/cocos-agent-bridge/asset-batch.schema.json`。

`assets.batch.plan/execute/get` 将 2–16 张本地 PNG 按顺序导入一个明确的 Creator 项目。它复用已验证的单张 `asset.importPng` 命令，因此 2.4 仍由 `Editor.assetdb.import` 导入，3.8 仍由 AssetDB 消息接口导入。资源公开工作流分别以 [2.4 资源手册](https://docs.cocos.com/creator/2.4/manual/zh/asset-workflow/index.html)和 [3.8 资源工作流](https://docs.cocos.com/creator/3.8/manual/zh/asset/asset-workflow.html)为基准。

计划阶段检查绝对源路径、PNG 签名、IHDR 和 1–4096 像素尺寸、10 MiB 大小上限、同批文件名冲突、目标 `assets/resources/` 中的文件和 `.meta` 冲突，并要求目标列表中恰有一个项目路径与 Creator 版本匹配的实例。执行阶段逐张再次检查源摘要及目标冲突，调用已协商的导入命令，核对回执中的资源名，再读回文件摘要和由 Creator 生成的 `.meta`。2.4 还核对 AssetDB 回执类型/UUID 与 `.meta` 主纹理一致，并检查 SpriteFrame 子资源的 `rawTextureUuid` 指向该主纹理；这符合 2.4 图像资源 Type=Sprite 时自动生成 SpriteFrame 子资源、Sprite 使用 SpriteFrame 的资源模型，详见[官方图像资源文档](https://docs.cocos.com/creator/2.4/manual/zh/asset-workflow/sprite.html)。元数据关系异常时将已经产生的导入副作用记为 `needs-review`，停止后续项，不把它误报为无副作用失败。记录在 `.cocos-agent/asset-batches/<batchId>.json`。明确无副作用的失败将当前项标为 `rejected`、保留此前成功项；结果不确定时停为 `needs-review`。中断于 `importing` 的记录不会自动重试，因为不能仅凭目标文件存在判定其归属。批次没有整体回滚或资产删除命令，不能视为原子事务。

同一个 `batchId` 读取历史结果。返回的 `items` 分别携带 `assetName`、`sha256`、`status` 和 Creator 原始回执。`completed` 表示各资源及 `.meta` 的导入和磁盘核对通过，不代表它们已经被场景引用、预览或构建。2.4 主资源类型为 `texture`，SpriteFrame 是 `.meta` 中的独立子资源；3.8 主资源类型为 `cc.ImageAsset`，本批示例的 `Texture2D` 子资源 ID 为 `@6c48a`，加载路径为 `图片名/texture`。不得跨版套用子资源路径。

2026-10-07，两版 Creator 分别导入红、蓝两张 2×2 PNG；四张资源均收到 `imported=true`，源/目标摘要一致且各自 `.meta` 已生成。两版资源保留为动态内容的复测样本。模拟测试覆盖全成功、计划阶段冲突及第二张明确拒绝的部分成功。2026-10-08 增加的 2.4 校验另覆盖精确项目/版本目标、PNG IHDR 尺寸，以及导入回执与 `.meta` 中 Texture → SpriteFrame 的 UUID 关系；元数据依赖不匹配时保留已知导入状态并停止后续项。未做场景引用批处理或导入期间进程中断注入。现有 Creator 生成 `.meta` 样本通过相同关系校验。

各资源 UUID、类型与摘要见[结构化记录](traces/cocos-agent-asset-batch-live-0.1.jsonl)。
