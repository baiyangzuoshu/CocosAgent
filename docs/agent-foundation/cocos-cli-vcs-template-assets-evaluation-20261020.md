# Cocos CLI：VCS、模板与资源包能力评估

日期：2026-10-20。范围：Creator 2.4.15；本文件记录后续取舍与验收条件，不代表这些命令已实现。

## 结论与顺序

当前应先完成分发、真实 Host/Creator 验收和测试运行器。随后先补只读的资源完整性诊断，再做场景/Prefab 语义差异；项目模板与资源包应经独立合同接入。暂不实现自动场景冲突合并，也不把 Editor/模块安装从 Dashboard 搬入 CLI。

| 候选能力 | 现有证据与缺口 | 后续范围 | 验收条件 |
| --- | --- | --- | --- |
| `vcs doctor/status` | CLI 没有资源与 `.meta` 配对的 Git 检查；Creator UUID 与引用需要保留 | 读取 Git 变更及所选工程的资产清单；报告缺失/孤立 `.meta`、重复主/子资源 UUID、缓存误跟踪、冲突标记 | 临时 Git 仓库分别制造上述问题；结果包括路径、证据与严重级别；不修改文件、暂存区或引用 |
| `vcs diff/affected` | 场景/Prefab 是 Creator 序列化对象图；文本行差异不能完整表达节点与组件变化 | 对比指定 Git blob 中的 `__type__`、`__id__`、`__uuid__`，按节点/组件给出增加、移除、属性与资源引用差异；未知类型保留原始差异 | 覆盖数组重排、UUID 保留、子资源、移除组件和不完整文件；无法推导的依赖标记为未知，不声称完整影响集合 |
| 冲突恢复 | 当前写操作有审批、前态校验和 reconcile，但不是 Git 场景合并器 | 先做冲突分类与恢复计划；涉及 UUID/对象图冲突时用 Creator 实机核对 | 恢复前后验证源/meta 哈希与场景引用；冲突未解决时不写“成功”，不自动选择整侧覆盖 |
| 项目模板 | Dashboard 已承担工程创建、版本选择与打开；CLI 没有模板清单/校验命令 | 第一阶段只读验证模板版本、文件清单、UUID 和来源；是否增加实例化合同另行评估 | 模板在 Creator 2.4.15 中生成并打开；重复实例化不覆盖旧工程；不可携带缓存、用户凭据或绝对本机配置 |
| 资源包导入/导出 | 本轮 Creator Package Manager 可见 `package-asset`（0.0.1，描述为导入导出资源插件），只证明内置插件存在；CLI 当前没有对应合同 | 先核对安装版本的公开 API/IPC 与资源依赖处理；建立包清单、UUID 冲突预检、审批导入及恢复记录 | 在临时工程导出含 SpriteFrame/纹理、Prefab、脚本的依赖集合；再导入第二工程，通过 AssetDB 与预览核对引用、冲突拒绝和恢复结果 |

## 边界

VCS 检查以明确的 Git 仓库根目录和 Creator 工程根目录为输入，不能假定二者相同；本仓库就包含独立工程。只读 Git 检查可以离线执行，涉及当前编辑器的资源导入或场景恢复仍需按 `AGENTS.md` 核对 Dashboard、窗口与扩展工程身份。

模板和资源包的源文件、`.meta`、主/子资源 UUID、导入器设置、场景/Prefab 引用都要保留。`library/`、`temp/`、`local/`、`build/` 不作为资源包源内容。资源包不能仅用普通文件复制的结果冒充 AssetDB 导入回执。

现有版本事实依据：[`docs/2.x/04-assets-and-loading.md`](../2.x/04-assets-and-loading.md) 的资产身份和导入证据、[`docs/2.x/02-objects-and-scenes.md`](../2.x/02-objects-and-scenes.md) 的对象/场景机制，以及 [`docs/2.x/12-editor-extension-and-diagnostics.md`](../2.x/12-editor-extension-and-diagnostics.md) 的扩展/AssetDB 边界。CLI 当前能力以 [`tools/cocos-creator-agent-cli/README.md`](../../tools/cocos-creator-agent-cli/README.md) 和共享命令合同为准。
