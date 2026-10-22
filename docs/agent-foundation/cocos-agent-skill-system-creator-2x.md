# Cocos Creator 2.4.x 第三方 Agent Skill 系统

日期：2026-10-18（2026-10-21 更新）。CLI 0.11.0 与 Creator 项目扩展 0.7.0 含 52 项 Skills；CLI 自动测试 67/67 通过。Creator 2.4.15 实机已验收脚本创建、批准式修改、恢复和哈希回读；当前空 `tank` 的 Web-Mobile 构建因未登记 start scene 而失败。CLI 已增加结构化 Builder 失败码，遇到 Builder 明确失败并且进程后续超时时保留两种信号；候选包已重新打包、全局安装，没有成功构建证据。GitHub Release、线上更新/回滚、桌面 Host 新工具目录重载仍待完成。Creator 原生 CocosAgent 已移除，旧插件仅作 CLI 引导。另有 5 项可选 SDK Skills。

## 产品边界

- `tools/cocos-creator-agent-cli/skills/`：Creator 2.4.x 通用技能唯一维护源。独立 CLI 将其与 `references/2x/` 一起打包，并用 `skill install` 分发到 Codex/Claude 原生 Skill 目录。
- `plugins/cocos-creator-agent/`：旧式 Codex/Claude 插件安装方式的兼容入口，只含 `cocos2-cli` 引导 Skill，不含 MCP server、领域 Skills 或 Creator 参考资料。
- `plugins/cocos-creator-agent-sdk/`：独立可选的 SDK Skills 插件，包含广告、内购、联网和语音集成工作流。SDK 插件未安装时，核心插件不加载这些内容。
- Creator 原生 CocosAgent 的源码与扩展已从仓库移除；相关研究文档和验收轨迹保留为历史材料，不是可用产品或当前实施计划。
- 原生 CocosAgent 已停用并移除；当前第三方 Skills 通过 CLI 安装到 Codex/Claude 原生 Skill 目录，第三方 Host 不调用原生模型/Provider。
- MCP server、客户端配置、CLI 与 Creator 桥接统一位于独立包 `tools/cocos-creator-agent-cli/`；合同、写入/运行能力与验收状态见[第三方接入实现](cocos-creator-third-party-integration-mvp-0.1.md)。

独立 CLI 提供 `mcp configure codex|claude-code|cursor|vscode`、`mcp serve` 与 `skill install/show/list/refresh`；Codex 和 Claude Code 通过各自 CLI 配置，Cursor 和 VS Code 使用各自 JSON 配置格式。Creator 引擎参考资料与 Skills 同属 CLI 发布包，按当前任务按需读取；其中源码和运行证据主要针对 2.4.15，不能外推到全部 2.4.x。旧式 bootstrap 插件保留 Host 元数据，仅为已有插件用户提供迁移入口。Codex 的插件打包参考 [OpenAI 插件打包文档](https://developers.openai.com/plugins/build/plugins)；Claude Code 插件结构参考 [Anthropic 官方插件结构](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/plugin-dev/skills/plugin-structure)。

## 路由 Skill

入口 `cocos-agent` 先确认当前 Host 工作区与目标 Creator 工程身份，再检查可用工具，随后只读一个最匹配的领域路由和必要专项 Skill。它不得假设某个 MCP、CLI、Creator 扩展或项目 API 已安装；没有 Creator-aware 工具时，明确指出编辑器状态/序列化资源哪些不能安全改动，并给出手动 Creator 步骤。

| 领域路由 | 分发范围 |
| --- | --- |
| `cocos2-project-workflows` | 新项目、依赖、通用工程/资源搜索、多文件开发 |
| `cocos2-scene-workflows` / `cocos2-prefab-workflows` | 场景层级、节点/组件、Prefab |
| `cocos2-script-workflows` | JS/TS 单文件和跨文件功能开发 |
| `cocos2-ui-workflows` | UI 结构、布局、组件属性、事件和脚本接线 |
| `cocos2-resource-workflows` | SpriteAtlas、纹理导入、字体/文本、本地化、动画和 TileMap |
| `cocos2-gameplay-workflows` | 2D/3D 物理、碰撞、导航 |
| `cocos2-audio-rendering-workflows` | 音频配置/优化、材质/Effect、渲染问题 |
| `cocos2-runtime-workflows` | 预览观察、运行错误、性能、动态内容和内存 |
| `cocos2-build-delivery-workflows` | Web/移动端构建、发布、Asset Bundle 和优化 |
| `cocos2-extension-workflows` | Creator 扩展、JSB、本地原生插件 |

全局入口加 11 个领域路由和 39 个专项 Skills，共 51 项。每个专项 Skill 使用窄触发描述；工作流按证据、工具可用性、操作范围、读回、成功条件和恢复边界组织。

## 51 项核心 Skill 目录

### 项目、依赖、搜索与代码

`cocos2-project-bootstrap`、`cocos2-package-management`、`cocos2-project-search`、`cocos2-project-development`、`cocos2-script-development`、`cocos2-script-workflows`、`cocos2-project-workflows`。

### 场景、Prefab 与 UI

`cocos2-scene-composition`、`cocos2-scene-node-operations`、`cocos2-scene-workflows`、`cocos2-prefab-source-edit`、`cocos2-prefab-workflows`；`cocos2-ui-structure`、`cocos2-ui-layout`、`cocos2-ui-component-properties`、`cocos2-ui-event-binding`、`cocos2-ui-script-wiring`、`cocos2-ui-workflows`。

### 资源与玩法

`cocos2-resource-scene-pipeline`、`cocos2-resource-workflows`、`cocos2-sprite-atlas`、`cocos2-texture-import-settings`、`cocos2-fonts-text`、`cocos2-localization`、`cocos2-animation`、`cocos2-tilemap`、`cocos2-gameplay-workflows`、`cocos2-physics-2d`、`cocos2-physics-3d`、`cocos2-navigation`、`cocos2-asset-bundle-content`。

### 音频、渲染、运行、构建

`cocos2-audio-rendering-workflows`、`cocos2-audio-configuration`、`cocos2-audio-optimization`、`cocos2-material-effects`、`cocos2-rendering-diagnostics`、`cocos2-runtime-workflows`、`cocos2-runtime-observation`、`cocos2-runtime-performance`、`cocos2-dynamic-content-performance`、`cocos2-native-memory-bridge`、`cocos2-build-delivery-workflows`、`cocos2-content-build`、`cocos2-web-mobile-optimization`。

### 扩展、工具与审阅恢复

`cocos2-extension-workflows`、`cocos2-creator-extension-development`、`cocos2-jsb-native-plugins`、`cocos2-project-extensions`、`cocos2-mcp-tools`、`cocos2-task-review-recovery`。

`cocos2-mcp-tools` 指导实例发现、合同读取和回执核对。CLI 是 Skills 的交付方式，不意味着 Skill 获得工具授权；项目级 `AGENTS.md`、`CLAUDE.md` 和自定义 Skills 属于目标项目约定，不能覆盖 Host 安全策略或实时工具合同。

## 可选 SDK Skills

独立包 `plugins/cocos-creator-agent-sdk/` 包含 5 项：`cocos2-sdk-integrations` 路由器、`cocos2-sdk-ads`、`cocos2-sdk-purchases`、`cocos2-sdk-networking`、`cocos2-sdk-voice`。只有用户任务明确涉及对应提供商、产品、SDK 版本与平台时才加载。Skills 不安装依赖、不持有密钥，也不代表真实支付、广告收益、联网或语音服务已验收。

## 版本与操作边界

- 面向 Creator 2.4.x；当前仓库的工具实现与实机证据基线仍是 2.4.15。核对项目实际 patch 和目标平台后再应用 API 细节。
- Skill 是任务流程知识，不是工具合同。先盘点 Codex/Claude 当前暴露的工具；只有已安装并声明的 Creator CLI/MCP/编辑器工具才能操作活动场景、Prefab、导入设置或运行状态。
- Host 文件工具可按项目约定编辑代码；无法通过 Creator-aware 工具安全处理的编辑器状态应说明具体缺口。禁止伪造 Creator 读回、编译、预览或运行结果。
- 保留 Creator 生成的 `.meta`、UUID 和资源引用；把源码落盘、Creator 接受、编译/构建、运行时行为分开报告。
- 参考资料只提供其明确版本/平台的证据。不要将 Creator 2.4.15 的实现细节泛化成全部 2.4.x 保证。

## 当前状态与后续

1. 51 项 Creator 工作流 Skills、1 项 CLI Skill 与 Creator 2.x 参考资料已迁入 CLI 包；CLI `skill install` 负责选择性分发与漂移检测。CLI `mcp configure` / `mcp serve` 接管 Host 配置与工具协议。
2. 旧式 `plugins/cocos-creator-agent/` 仅保留一个兼容引导 Skill；它的 Codex/Claude 元数据不再注册 MCP，也不分发工作流内容。
3. CLI 0.10.6 的 59 项测试通过；CLI 0.11.0 本地 tarball 已全局安装，隔离包含三条 `creator.script.modify.*` 命令；CLI 测试 67/67 通过。Creator 2.4.15 / 扩展 0.7.0 上已有脚本批准式修改/恢复、CLI 与 MCP 哈希回读及错误前态拒绝的实机证据。Creator 编译没有事件回执；空 `tank` Web-Mobile build 因无 start scene 失败，CLI 已用机器可读失败码覆盖 Builder 退出码为 0 的情形。Codex/Claude 配置均指向全局 CLI，52 项 Skills 与参考资料已安装。MCP 目录可读取同一 Creator 实例；配置回执不代表桌面 Host 新工具目录已重载。
4. Creator 2.4.15 上 Provider 审批写入、取消拒绝、恢复读回与同会话输入断言已通过；脚本源文件修改/恢复切片也已实机验收。场景固定写入、编译成功、有效项目构建和测试诊断仍待验收。GitHub Actions 因 billing locked 未运行，候选包与 SHA-256 尚未发布；线上 Release、自更新和回滚仍未通过。tank 的验收脚本已通过 Creator 清理，AssetDB 为空，场景恢复默认 `New Node`；扩展 0.7.0 源码保留在工作区。详见[最新验收](traces/cocos-cli-0.10.0-goal-20261020.md)。
