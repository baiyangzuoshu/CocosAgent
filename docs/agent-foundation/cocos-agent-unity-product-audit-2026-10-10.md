# CocosAgent 对照 Unity Agent 的产品审核

审核日期：2026-10-10。当前产品目标仅为 Cocos Creator 2.4.15。

本报告响应新的开发方向：以真实游戏项目的任务推动 CocosAgent；遇到缺少的工具或操作知识，再补命令或 skill。以下是源码、插件包、只读 Creator 查询和官方 Unity 资料的审核结果，尚未作为新的实现计划执行。

## 对照范围

近期建议优先对齐 Unity 官方的外部 Agent 插件路径：外部 coding agent → 插件/skills → CLI 或 MCP → 编辑器通信包 → 当前项目。Unity 官方将外部插件、CLI/MCP 与内置 Assistant 分别提供；它们可以组合，也可以分别使用。因此，对齐官方插件不要求同时扩展一套独立的聊天、模型管理和任务调度产品。

官方依据：

- [Unity 官方 Agent 插件](https://github.com/Unity-Technologies/unity-agent-plugin)：插件提供工程 skills，通过 Unity CLI 操作正在运行的 Editor，并可利用外部 coding agent 的代码编辑能力。
- [Unity CLI 集成说明](https://github.com/Unity-Technologies/skills/blob/main/skills/unity-cli/references/integration-advanced.md)：明确项目选择、每实例认证、命令发现，以及 MCP `tools/list_changed` 通知。
- [Unity 运行验证流程](https://github.com/Unity-Technologies/skills/blob/main/skills/unity-cli/references/playmode-verification-loop.md)：进入 Play、确认帧推进、观察画面、读取 Console，再调整和验证。截图本身不能证明游戏仍在运行。
- [Unity 官方 AI 工具概览](https://unity.com/features/ai)：分别介绍官方插件、CLI/MCP 与内置 Assistant。

## 本次实际读回

| 检查对象 | 实际结果 | 含义 |
| --- | --- | --- |
| 当前 Creator 实例 | `2.4.15NewProject`，Creator 2.4.15，活动场景 `helloworld`，`state=ready` | 上轮“整个目录仍被阻断”的状态已经变化 |
| 当前能力目录 | 14 个命令；`content.stress.run` 为合同 0.2、available | 编辑器已报告新的压力合同；尚不能据此认定压力执行验收通过 |
| Prefab 源编辑 | `prefab.source.inspect` available；`prefab.source.patch` unavailable，原因 `PREFAB_EDIT_MODE_API_UNAVAILABLE` | 已有实现，当前会话尚不具备可执行的源写入路径 |
| 本会话加载的 MCP 工具 | 39 个；压力工具仍使用 `maxResourceLoadP95Ms` 等旧输入 | 编辑器目录、MCP 工具 schema 存在版本分裂 |
| 工作区新 MCP 服务 | 通过 InMemoryTransport 只发现工具，不调用命令：42 个工具 | 比本会话多出三个跨 Bundle 依赖工具 |
| 新压力工具 schema | 要求 `loadMode`、`budgetProfileId`、冷/热加载预算和 RGBA 工作集预算 | 本会话旧压力 schema 无法表达完整的新合同 |
| 已安装插件缓存 | 1 个 skill：`cocos-agent` | 已安装包尚未包含仓库新增的任务 skills |
| 仓库插件产品包 | 6 个 skills | 代码存在与用户可调用能力之间有分发缺口 |
| 研究与工作流目录 | `docs/agent-foundation/skills/` 有 53 个 skills | 该数量包含 2.x/3.x 研究和诊断资料，不能视为已安装产品技能数 |

本次 Creator 查询只有实例和能力读取。MCP 新服务的发现使用内存传输和禁止命令执行的适配器；未执行场景写入、构建、压力测试或模型请求。

## 真正缺少的部分

### P0：版本与安装状态可核验

需要统一检查 Creator 扩展、Host、MCP schema、插件 skills 的版本和指纹，使用户能知道实际加载了哪一份实现。当前扩展和 MCP 包仍以固定 0.1.0 标识，无法解释上述 schema 与 skill 差异。

`tools/cocos-agent-bridge/catalog-host.js` 要求命令数量、合同版本与 schema 完全匹配；一项不兼容会使整个实例 unavailable。保留逐命令严格校验，并补充兼容命令的可用状态、明确的不兼容原因和更新后的工具发现。采用动态通知或经过验证的重载机制时，也要确认宿主实际接收了新 schema。

### P1：可接入独立真实项目的安装流程

`configure-local-plugin.mjs` 已能注册额外项目，绝对路径本身不是问题。缺口是 Creator 扩展的安装、升级与检查，以及 Host 的稳定位置配置。内置 Assistant 的 Host 入口通过 `main.js` 第 1326 行的相对路径查找，依赖当前研究仓库布局；插件 skills 也引用包外的研究文档。

需要在仓库外的真实 Creator 2.4.15 项目中验证：安装扩展、注册项目、查询能力、正确选择实例、升级并读回实际版本。最终产品包应拥有可解析的必要资源，或者声明和校验其外部依赖位置。

### P1：普通项目的发现、编辑与运行反馈

现有工具集中于 PNG、有限 Sprite/Label 属性、专属流水线和内容构建。通用资产查询与引用检索、用户脚本组件属性发现、场景选择、组件增删、节点删除/换父节点等操作尚未形成可供模型调用的通用合同。是否扩充以及扩充哪些，应由首个真实项目任务决定。

当前 MCP 工具列表没有通用编辑器 Console、脚本编译错误、Game View 截图和运行帧推进查询入口。现有探针和特定内容运行时回执值得复用，但仍需让 Agent 能直接调用必要的观察能力。普通项目预览和构建也需要支持项目当前场景/配置，避免要求所有任务先创建内容 release。

外部 coding agent 已能进行文本代码搜索和编辑；应补上它与 Creator 导入、编译反馈、场景状态和运行验证之间的接线。只有选择发展独立内置 Assistant 时，才需要为该模型运行器另行提供受控的代码读写能力。

### P1/P2：已有 skill 能被发现、加载并正确使用

内置 `assistant-host.mjs` 仅传入基础 `cocos-agent` skill。`deepseek-agent.mjs` 的 `loadContext` 只读取固定的 `cocos://2x/agent/mcp-tools` Resource 和启动参数传入的 skill 文件；模型工具列表中没有 Resource 读取或 skill 读取入口。

基础 skill 要求读取场景组合 Resource 或使用其他命名 skill，但默认内置运行器不能按请求补读它们。外部宿主能否读取 Resource 属于宿主能力；当前已安装插件的新增 task skills 也尚未分发。优先修复已有技能的安装与加载，再根据真实项目任务新增。

Prefab 源检查是只读命令，却只通过标记为可写的混合 executor 暴露；Ask 模式会过滤该 executor。这需要补齐只读查询的可达性。

### P2：真实项目任务的验收样本

已有技术探针和示例工程证据较多，仍缺一个真实游戏工程的连续任务样本：用户描述需求 → 理解项目约定 → 修改代码/场景/资源 → 编译与运行 → 读日志和画面 → 修复或报告失败 → 提交可审阅差异。

这项验收应驱动后续工具覆盖。Prefab 源编辑、跨 Bundle 合同和压力合同 0.2 均已有代码；它们的未完成项主要是特定实机路径及完整执行验收，不能重复当作从零开发的新功能。

## 可以缩减或降低优先级的部分

| 部分 | 审核建议 | 理由 |
| --- | --- | --- |
| 独立 DeepSeek 调度器与 Creator 聊天面板 | 保留已有功能，近期作为可选入口 | 外部 coding agent 已提供模型、代码工具、对话和审批；继续并行扩展两套调度会增加维护范围 |
| 内容 release、selected/effective、跨 Bundle 租约、专属运行时更新 | 保留为按需使用的内容生产工具 | 适用于动态内容任务；普通场景/界面/脚本编辑没有必要经过完整发布流程 |
| 性能压力、原生测量与源码优化案例 | 保留已有证据，待项目问题触发后继续 | 它们支持招聘能力和性能诊断，但当前优先级应由实际开发阻塞决定 |
| 文档与插件中同名 skill 的不同文本 | 收敛到一个权威源并生成分发副本 | `cocos2-resource-scene-pipeline` 和 `cocos2-scene-composition` 都存在两份不同内容，容易发生规则与状态漂移 |
| MCP、catalog、扩展中的重复 schema 定义 | 收敛命令描述，再生成或适配各层 schema | 相同字段需多处修改，当前压力版本分裂已体现维护成本；协议边界仍需要各自校验 |
| 过多顶层工具和历史试验入口 | 按任务组织，保留底层复用 | `scene.pngSprite`、节点创建、组合和资源流水线有不同层次的用途；统一入口和说明可以降低模型选错流程的概率，无需立即删除历史实现 |
| 预先铺开 UI、音频、物理等产品 skills，以及新增 3.x 能力 | 等实际项目任务触发 | 研究资料保留为参考，产品 skill 按真实需求补齐 |

## 应保留的基础

精确实例选择、项目注册边界、只读与写入的访问区分、陈旧状态检查、UUID/元数据验证、保存读回、持久操作回执、不确定写入对账和失败补偿均服务于真实编辑器操作。简化用户流程时，应复用这些基础，减少重复的编排与人工操作。

## 建议下一轮范围

1. 对齐实际加载的插件、MCP 和扩展，并提供可读的版本/指纹诊断。
2. 接入一个独立的真实 2.4.15 游戏工程，完成一个具体开发任务。
3. 为该任务补必要的日志、运行观察和编辑命令；记录缺口及失败原因。
4. 将成功且可复用的步骤整理为产品 skill，由同一来源发布和验证。

当任务已有工具但缺少步骤知识时补 skill；当编辑器操作本身无法完成时补命令；当观测结果不足时补验证入口。避免用增加 skill 数量代替能力接线与运行证据。
