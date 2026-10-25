# Cocos Creator 2.4.x 第三方 Agent Skill 系统

更新日期：2026-10-25。CLI 包与 GitHub 最新 Release 版本均为 `1.0.0`，Creator 扩展为 `0.8.127`；此前自动化测试 `371/371` 通过（本次版本范围改动未重跑）；CLI 当前接受 Creator `2.4.1`–`2.4.16`，自动按 `2.4.16` 到 `2.4.1` 降序选择；实机版本证据仍只覆盖 `2.4.15`。Tank 项目已通过 CLI 关闭、重开和 doctor `9/9` 检查。UI 组件接口与实机证据见 [UI 验收矩阵](cocos-cli-ui-acceptance-matrix-2.4.15.md)；Prefab 已验收直接删除既有末尾 `cc.BlockInputEvents` 并来源补偿恢复、Material 数组资源追加，以及 Button.target 节点引用和 Slider.handle 组件引用往返；其他既有组件删除和数组/属性组合仍未完成。完整命令、版本、能力边界及各类编辑记录以[独立 CLI README](../../cocos-creator-agent-cli/README.md)为准。Creator 原生 CocosAgent 已移除，旧插件仅作 CLI 引导。另有 5 项可选 SDK Skills。

## 产品边界

- `cocos-creator-agent-cli/skills/`：Creator 2.4.x 通用技能唯一维护源。独立 CLI 将其与 `references/2x/` 一起打包，并用 `skill install` 分发到 Codex/Claude 原生 Skill 目录。
- `plugins/cocos-creator-agent/`：旧式 Codex/Claude 插件安装方式的兼容入口，只含 `cocos2-cli` 引导 Skill，不含 MCP server、领域 Skills 或 Creator 参考资料。
- `plugins/cocos-creator-agent-sdk/`：独立可选的 SDK Skills 插件，包含广告、内购、联网和语音集成工作流。SDK 插件未安装时，核心插件不加载这些内容。
- Creator 原生 CocosAgent 的源码与扩展已从仓库移除；相关研究文档和验收轨迹保留为历史材料，不是可用产品或当前实施计划。
- 原生 CocosAgent 已停用并移除；当前第三方 Skills 通过 CLI 安装到 Codex/Claude 原生 Skill 目录，第三方 Host 不调用原生模型/Provider。
- MCP server、客户端配置、CLI 与 Creator 桥接统一位于独立包 `cocos-creator-agent-cli/`；合同、写入/运行能力与验收状态见[第三方接入实现](cocos-creator-third-party-integration-mvp-0.1.md)。

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

- CLI 与扩展接受 Creator 2.4.1–2.4.16，自动按补丁版降序选择；当前实现细节与实机证据仍主要基于 2.4.15。核对项目实际 patch 和目标平台后再应用 API 细节。
- Skill 是任务流程知识，不是工具合同。先盘点 Codex/Claude 当前暴露的工具；只有已安装并声明的 Creator CLI/MCP/编辑器工具才能操作活动场景、Prefab、导入设置或运行状态。
- Host 文件工具可按项目约定编辑代码；无法通过 Creator-aware 工具安全处理的编辑器状态应说明具体缺口。禁止伪造 Creator 读回、编译、预览或运行结果。
- 保留 Creator 生成的 `.meta`、UUID 和资源引用；把源码落盘、Creator 接受、编译/构建、运行时行为分开报告。
- 参考资料只提供其明确版本/平台的证据。不要将 Creator 2.4.15 的实现细节泛化成全部 2.4.x 保证。

## 当前状态与后续

1. 51 项 Creator 工作流 Skills、1 项 CLI Skill 与 Creator 2.x 参考资料已迁入 CLI 包；CLI `skill install` 负责选择性分发与漂移检测，`mcp configure` / `mcp serve` 管理 Host 配置与工具协议。
2. 旧式 `plugins/cocos-creator-agent/` 仅保留兼容引导 Skill；MCP server、Creator 工作流 Skills、桥接与命令合同由独立 CLI 包维护。
3. 当前功能基线、发布命令和不支持边界以 [CLI README](../../cocos-creator-agent-cli/README.md) 为准；组件逐字段接口/实机状态以 [Creator 2.4.15 UI 验收矩阵](cocos-cli-ui-acceptance-matrix-2.4.15.md) 为准。源码支持不等于目标平台和运行时行为已验收。
4. Prefab 源编辑和场景实例 Apply/Revert 分别记录；直接删除既有组件目前只对可还原的末尾 `cc.BlockInputEvents` 实机通过。完整记录见 [Prefab 子树与组件验收](cocos-cli-prefab-subtree-acceptance-20261024.md) 和 [Prefab Apply/Revert 验收](traces/cocos-creator-cli-prefab-instance-apply-revert-acceptance-20261025.md)。其他既有组件删除、任意组件引用恢复和剩余 UI 字段/平台行为继续列为待办。
