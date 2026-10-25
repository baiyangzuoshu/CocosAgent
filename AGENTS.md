# 仓库工作路由

本文件只保留仓库级边界、强制核验规则和专题入口。**不要把全部专题知识、运行回执和历史进度塞回本文件；接到具体任务后再读取对应 Skill、合同或研究记录。**不要为了普通任务加载无关版本或全部技能。

## 先识别任务，再加载资料

| 任务 | 入口 |
| --- | --- |
| Codex / Claude Code 的 Creator MCP/CLI/Skills/桥接与后续开发 | CLI 是 MCP server、客户端配置和 Creator Skill 分发的唯一所有者；读 `tools/cocos-creator-agent-cli/README.md`、`plugins/cocos-creator-agent/README.md`、[第三方 Skill 设计](docs/agent-foundation/cocos-agent-skill-system-creator-2x.md)和[第三方接入实现](docs/agent-foundation/cocos-creator-third-party-integration-mvp-0.1.md)；SDK 任务才额外读 `plugins/cocos-creator-agent-sdk/README.md` |
| Creator 2.4/3.8 工程或引擎源码修改 | 先确认版本，再读 `docs/2.x/` 或 `docs/3.x/` 对应专题；只加载当前任务匹配的 Skill。跨版本结论再读 `docs/comparisons/` 同编号专题 |
| Cocos2d-x 4.x 开发、构建或诊断 | 读 `docs/cocos2d-x-creator2x-source-study-plan.md` 中的版本/证据边界，并从 `plugins/cocos2d-x-4/skills/` 加载对应专题 Skill |
| Cocos2d-x 与 Creator 对照或移植 | 只读 `docs/comparisons/cocos2d-x-4-vs-creator-2.4/` 中相关专题 MD；通用架构入口为 `docs/comparisons/cocos2d-x-4-vs-creator-2.4.md`。比较 MD 是按需资料，不存在通用比较 Skill |
| Creator 内部机制与第三方接入事实 | 按当前任务查阅 `docs/agent-foundation/`；当前操作只使用第三方接入合同。Creator 原生 CocosAgent 文档与轨迹均为历史档案，不代表仓库仍提供原生 Agent 工具 |

专题 Skill 指导 Agent **如何完成一种任务**；比较 MD 保存 **Cocos2d-x 与 Creator 的对照事实和证据**。普通开发不加载比较 MD；跨引擎比较/移植时才加载对应专题。

## 仓库级约束

- **Creator 工程身份：** 每次需要打开或切换 Creator 工程，先在 Cocos Dashboard 核对项目名称、绝对路径、Creator 版本和打开状态；进入编辑器后再核对窗口版本及面板报告的工程路径。身份不一致就停止，不调用项目工具、不读写工程。
- **版本边界：** 当前第三方 CLI/MCP/Creator 扩展实现与实机验收只推进 Creator 2.4.15。Creator 3.8 新功能、场景接线和实机验收暂停；只有用户明确要求或涉及现有数据完整性/安全问题时再触及，并说明范围。
- **产品线边界：** Creator 原生 CocosAgent 已停止并从当前仓库移除；不要从历史文档或备份恢复其产品实现。`tools/cocos-creator-agent-cli/` 独立拥有 Codex/Claude MCP server 配置与 Creator Skills；`plugins/cocos-creator-agent/` 只保留兼容引导 Skill，不得恢复插件内 MCP server 或重复维护领域 Skills。Creator 项目扩展仍由 CLI 独立安装/更新。可选厂商 SDK Skills 独立放在 `plugins/cocos-creator-agent-sdk/`。
- **项目数据：** Creator 资源、场景和 Prefab 要保留编辑器生成的 `.meta`、UUID 与引用；不要把 `library/`、`temp/`、`local/`、`build/` 等缓存/产物当成源文件。跨版本操作分别实现、分别验证。
- **证据表述：** 区分文档、静态源码、构建、测试、编辑器与目标运行时证据；明确版本、平台、工程和限制。源码接线、模拟测试或构建成功都不能替代目标编辑器/运行时验收。
- **外部准备：** 执行构建前先核对项目要求的工具链、SDK、依赖和子模块。下载依赖、安装工具或改全局环境前先取得用户授权。
- **Git：** 用户要求提交时，提交说明使用中文；提交前检查暂存区，只提交本任务相关文件，不带入其他未提交内容。

## 常用源码入口

- `engine/2.4.15engine/`：Creator 2.4.15 JS 引擎源码。
- `engine/3.8.7engine/`：Creator 3.8.7 引擎源码。
- `engine/cocos2d-x-4/`：Cocos2d-x 4.0 本地源码。
- `2.4.15NewProject/` 示例工程已删除；文档中保留的对应路径只用于说明历史观测，不是当前工程入口。
- 根目录 Git 仓库不包含所有嵌套工程的独立 Git 历史。提交前确认当前仓库根目录及暂存区。
