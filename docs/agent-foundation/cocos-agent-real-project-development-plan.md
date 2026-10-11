# CocosAgent Creator 原生 Agent 开发计划

制定日期：2026-10-11。状态：**产品方向已确认；独立扩展包和 Creator sidecar 首轮接线已改造，Creator 2.4.15 重载后面板显示已连接；只读 Ask 与任务工具调用仍待验收。** 当前适用版本：Cocos Creator 2.4.15。

## 1. 目标

让开发者在 Cocos Creator 内直接向 CocosAgent 描述游戏开发任务。Agent 能读取当前工程和编辑器状态、形成可审阅计划、调用经校验的编辑器能力，并用磁盘读回、导入/编译反馈、预览画面和运行状态验证结果。失败时明确说明已完成步骤与副作用，并使用已有记录恢复。

**主产品不能依赖 Codex 进程、Codex 插件缓存、Codex MCP 配置或其他外部 Agent 才能运行。** Creator 可以启动和管理本机 sidecar 处理模型请求、文件操作或持久记录；sidecar 由 Creator 产品生命周期拥有，不以 Codex 为启动器或必要宿主。外部 MCP 可以保留为可选适配器。

## 2. 产品与进程边界

```text
Cocos Creator 2.4.15
  └─ CocosAgent 扩展与面板
       ├─ 对话、计划、权限、模型配置和执行状态
       ├─ Agent 调度与可版本化的任务知识读取
       ├─ 共享命令合同、实例/项目身份和操作账本
       └─ Creator 编辑器适配层
            ├─ 场景、节点、组件和资源操作
            ├─ 保存/导入/编译反馈、预览、日志与画面观察
            └─ 回执、对账、补偿与恢复
                 └─ 当前游戏项目

可选互操作：外部 Agent → MCP/CLI 适配器 → 同一命令合同与 Creator 扩展
```

Creator 扩展是用户入口、生命周期所有者和产品状态的权威来源。现有 Assistant 已由 Creator 扩展启动本地 `assistant-host.mjs`，再由它启动自己的 MCP stdio 子进程；这是 Creator 管理的内部传输，不等于依赖 Codex 管理的 MCP Host。当前新增独立打包器将扩展源码、skills、引用资料和 MCP 依赖放入 Creator 扩展包；sidecar 仍要求本机提供 Node.js 20+。Agent 调度可以位于扩展运行时或 Creator 启动的本地服务中；不预设把所有工作塞进编辑器进程。无论内部如何拆进程，关闭 Codex 后，Creator 内的 Agent 仍须独立完成其支持的任务。

模型调用采用可替换的 Provider 接口。现有原型支持 DeepSeek Flash/V4 Pro 配置，真实调用只验收过 Flash；Key 改为明文保存在 OS 用户配置目录 `~/.cocos-agent/credentials.env`（Windows `%USERPROFILE%` 下），POSIX 设置 `0600`。这避免将 Key 写进游戏项目，但还不是系统密钥链加密存储；不得把 Key 写入场景、操作轨迹或版本库。

## 3. Unity 对照原则

Unity 官方同时提供 Editor 内的项目感知助手，以及供外部 IDE Agent 使用的 Gateway、MCP/CLI 和插件。我们选择 **Editor 内原生助手**作为主产品参照：面板与当前项目深度集成，具备 Ask/Plan/Agent 类工作流、清晰权限、执行状态和可撤销修改；MCP/CLI 只作为之后可选的外部互操作入口。

参考：[Unity 官方 in-editor Assistant 与 MCP 说明](https://unity.com/blog/unity-ai-how-to-get-started)、[Unity AI 工具入口与外部接入对照](https://unity.com/features/ai)。Unity 的具体实现不推定为 Cocos 的实现方案；Creator API、扩展生命周期、平台支持与项目上下文均以 2.4 手册、本地源码和 Creator 实测为准。

## 4. 开发步骤与验收

### 0：盘点现有实现，确定 Creator 所有的运行边界

已修正扩展的服务入口为扩展包内 `assistant-runtime/.../assistant-host.mjs`，扩展 WebSocket 依赖随包携带；凭据写入用户目录；MCP 运行时指纹由 Codex 插件字段改为通用 Agent 技能包字段。`package-creator-extension.mjs` 可构建扩展包或向开发扩展安装 runtime，包内不需要 `.codex-plugin`、`.mcp.json` 或 Codex 进程。自动测试已在仓库外临时目录完成 MCP 工具、11 个技能和 29 份引用资源的发现、读取及哈希核对。Creator 2.4.15 `2.4.15NewProject` 扩展运行时安装后，编辑器界面重载并再次打开 Assistant 面板；面板显示 `已连接 · deepseek-flash · Key 已保存在本机`。独立打包的 Assistant Host CLI 冒烟在沙箱中绑定 `127.0.0.1` 收到 `EPERM`，但 Creator 实机面板达到已连接状态。尚未发送模型 Ask，也未验证本轮 Agent 发起的只读命令调用。

**完成标准：** 补齐现有原型的进程图、依赖清单和独立工程安装验证；确认 Creator 扩展/Creator 管理的 sidecar 与可选外部 MCP 的边界。此步只做检查与设计，不重写已能工作的模型调度。

### 1：Creator 内的只读 Agent 最小闭环

将现有 Creator 面板原型作为基线，而非重做聊天 UI。先把它从仓库固定相对路径中解耦，使扩展可安装到任意用户的 2.4.15 工程；再核对 Provider 设置、只读上下文、运行状态和错误回执是否完整。已有 Ask/Plan/Agent、实例/能力查询和 Creator 管理的 MCP 子进程优先复用。

**完成标准：** 不启动或连接 Codex 管理的 MCP Host，用户在 Creator 中输入问题后，Agent 能选择正确的 2.4.15 实例与项目，调用只读能力并根据回执回答。Creator 扩展可自行启动/停止其本地服务。模型凭据按明确的本地存储设计读写，关闭/重开 Creator 后行为可解释，凭据不进入日志或 Git。

### 2：Agent 计划与任务知识读取

把任务拆解、工具选择、权限判定和步骤结果做成显式调度循环。Creator 原生 Agent 能按任务发现并读取版本化 skill/参考资料，不依赖 Codex 插件目录；先用现有 2.4 skills 作为内容来源，确定 Creator 包内的安装、索引、版本与校验方式。

**完成标准：** Agent 能针对一个只读真实项目任务展示计划、读取相关 skill、调用工具并解释停止原因；目录和文档中的版本/指纹能核对。

### 3：一个受控写入任务的完整闭环

复用现有 2.4 语义命令与恢复账本，选一个真实任务验证：写入前展示目标和预期改动，按权限策略执行；之后做保存/导入读回、预览与必要日志检查。失败时按操作 ID 查询和恢复，禁止盲目重试。

**完成标准：** Creator 内 Agent 在不依赖 Codex/MCP 的情况下完成一次从自然语言到实际改动的任务。目标选择、before 状态、实际差异、回执、磁盘读回和预览/运行证据齐全；补偿或失败停止路径经过验证。

### 4：按真实任务补观察与编辑能力

依据实际项目阻塞，逐项补 Console/脚本编译反馈、资源查询、Prefab/组件操作、普通项目预览/构建或运行时观察。扩展已有操作时保持合同白名单、陈旧状态拒绝、UUID 校验、结果读回和故障恢复。性能、Bundle、原生和引擎源码工作由具体任务与测量结果触发。

**完成标准：** 每项新增能力关联一个可复现用户任务，且由 Creator Agent 实际调用并完成端到端验收；工具声明或模拟测试不单独算通过。

### 5：可选外部 Agent 适配

在原生 Agent 已能独立完成任务后，再决定是否继续维护 Codex/其他客户端的 MCP、CLI 与 skills 插件接入。它们复用同一命令合同、实例选择、权限和账本，不得成为 Creator 内 Agent 的运行依赖。

**完成标准：** 外部工具的启停、schema 更新或卸载不影响 Creator 内 Agent；两条入口对同一命令使用相同版本与安全规则。

### 6：真实项目持续验证与 3.x 后续规划

用用户指定的真实 2.4.15 工程连续完成任务，按反馈增加能力并沉淀 Creator 可读取的任务知识。只有 2.4.15 原生路径达到可重复验收后，才制定 Creator 3.8 适配计划；保留所有已有 3.x 研究和证据。

**完成标准：** 连续多轮任务中，Agent 能正确选择项目、保持场景/资源/Prefab 关系，报告实际运行结果，并处理失败与恢复；新增步骤可复跑和审查。

## 5. MVP 验收总门槛

1. Creator 是 Agent 的产品入口；Codex、Codex 管理的 MCP Host 和插件缓存均可不运行。Creator 自己管理的 MCP stdio 进程可作为内部实现，但不得由 Codex 提供或托管。
2. 面板展示当前工程、Creator 版本、计划、工具调用、验证结果和失败状态。
3. 使用用户配置的 Provider；凭据不进入项目和日志。
4. 首先通过只读问答，再通过一个低风险写入任务；写入经现有账本、保存读回和预览/运行验证。
5. 验收基于真实 Creator 2.4.15 与真实工程。保留 MCP/CLI 是可选兼容，不改变上述门槛。

## 6. 当前执行状态

| 步骤 | 状态 | 下一步 |
| --- | --- | --- |
| 0：边界盘点 | 扩展代码与打包器已改；Creator 2.4.15 重载后面板显示已连接 | 补独立扩展包安装验收，并留存 Creator 管理 sidecar 的启动/停止证据 |
| 1：原生只读闭环 | MCP 技能包可脱离仓库读取；Creator 面板已连接，Agent 问答未验收 | 在 Creator Ask 中完成一次只读实例、场景查询，确认真实模型回执和工具轨迹 |
| 2：计划与知识读取 | Ask/Plan/Agent 原型已存在；原生 skill 分发未验收 | 复用已有步骤卡，设计 Creator 包内技能索引、读取与内容指纹 |
| 3：受控写入闭环 | 既有 2.4 命令具备多项单独验证；Creator 原生 Agent 编排未验收 | 复用已有任务命令完成一次原生 Agent 端到端验收 |
| 4：任务驱动扩展 | 按需 | 由真实工程的可复现阻塞决定 |
| 5：外部 Agent 适配 | 可选 | 原生路径稳定后再决定维护范围 |
| 6：持续验证与 3.x | 2.4 持续推进；3.x 暂停新增 | 以真实工程可重复验收作为后续 3.x 规划门槛 |
