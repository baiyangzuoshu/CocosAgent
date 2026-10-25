# Creator 原生 Agent 0.1

归档：Creator 原生 CocosAgent 与旧示例工程 `2.4.15NewProject/` 已停止维护并从当前工作区移除。以下内容只记录当时的实机操作，不是当前安装指南；当前 CLI 入口见 [Cocos Creator Agent CLI](../../cocos-creator-agent-cli/README.md)。

状态：2026-10-10，Windows + Creator **2.4.15** + DeepSeek **Flash** 完成首条实机切片。面板内直接对话并切换 Ask、Plan、Agent；此次写入范围为独立临时空节点。不是完整 Unity Assistant 功能集，不表示 3.8 或全部 MCP 工具已经通过真实模型验收。

2026-10-11，Creator 原生 Ask 已在 macOS 2.4.15 实机验收；按需 skill 目录、正文与引用读取已接入模型工具循环，并由自动化模型循环测试验证。Creator 已安装运行时尚未更新到包含此能力的包，因此“Creator 面板中的真实模型按任务读取 skill”仍待重载新包后实测。

## 历史操作记录

1. 实机测试使用了 `2.4.15NewProject` 和 `cocos-agent-bridge` 扩展；示例工程现已删除。
2. 当时在本机安装 Node.js 20+，并按旧工程中的 `packages/cocos-agent-bridge/README.md` 构建可安装目录；该说明不在当前工作区。
3. 当时从 **扩展 → CocosAgent → Assistant** 打开面板，输入 DeepSeek Key 后连接；勾选“记住 Key”会保存到 OS 用户配置目录，重启 Creator 后自动恢复。
4. 当时可选择模式并在面板输入；Enter 发送，Shift+Enter 换行。Agent 每项非只读操作均显示工具及完整参数，批准后执行；拒绝或等待超过 120 秒不会执行该项。

原型最初把 Key 保存到 `.env.local`。当前 Creator 原生改造将“记住 Key”移到当前 OS 用户目录 `~/.cocos-agent/credentials.env`（Windows 为 `%USERPROFILE%\\.cocos-agent\\credentials.env`），避免把凭据写进游戏项目；该文件仍为明文，需限制访问并避免分享。改造后需在面板重新输入一次之前保存的 Key。Flash 已真实验收，V4 Pro 仅有配置选项，未在本轮调用。

## 三种模式

| 模式 | 模型可用工具 | 本轮实测 |
| --- | --- | --- |
| Ask | 仅 `readOnlyHint=true` 的 MCP 工具 | 查询实例、能力、场景和 Canvas；没有项目写入 |
| Plan | 同上；回答有序步骤与验证、恢复条件 | 为临时节点给出中文计划，没有创建节点 |
| Agent | 当前 2.4 MCP 工具；非只读调用逐项批准 | 拒绝、批准创建、记录读回、身份核对、补偿、节点不存在读回 |

模式过滤由 Agent 服务执行，UI 切换不能扩大权限。每轮先查询已注册项目的就绪实例，再读取能力；未注册项目、不可用命令及未查询实例会被拒绝。遇到不确定写入，只允许操作查询/对账，禁止盲目重发。模型多工具并发响应整批不执行，最多两次纠正后停止。

Plan 会输出带版本号的结构化步骤卡，字段包含说明、前置条件、验证和恢复；用户点击开始后进入 Agent，每次只开始当前一步，完成后用户逐步点击继续。前一步成功的 MCP 工具回执会作为只读观察传入下一步，支持延续节点 UUID / operation ID 等现场证据。每个写操作仍需单独审批；拒绝后可重试当前未执行步骤，不确定结果会锁定计划等待回执核对。计划保存在服务内存，Agent 是已有 MCP 合同范围内的操作，不含任意 JavaScript、脚本文件编辑或终端工具。

## 实现与凭据

`panel/index.js → Creator IPC/main.js → assistant-host.mjs → deepseek-agent.mjs → MCP stdio → JSONL Host → 2.4 扩展`。

- 面板使用官方 `Editor.Panel.extend` 和 `messages(event, ...args)` 接收 IPC，参见 [2.4 面板参考](https://docs.cocos.com/creator/2.4/manual/zh/extension/reference/panel-reference.html) 与 [IPC 工作流](https://docs.cocos.com/creator/2.4/manual/zh/extension/ipc-workflow.html)。扩展声明 `dockable`；本轮实际为独立编辑器窗口，拖入主窗口的停靠交互尚未验收。
- 本地对话服务只监听 `127.0.0.1` 随机端口，使用随机令牌路径。主进程通过子进程环境传 Key，不放入命令行；MCP 子进程过滤 `DEEPSEEK_*` 环境变量。
- Key 在面板输入；勾选保存时写入当前 OS 用户目录的 CocosAgent 凭据文件，连接后密码框清空；扩展启动时自动恢复。取消勾选或点“忘记 Key”可移除配置。主进程通过子进程环境传 Key，不放入命令行；轨迹按实际 Key 和 `sk-` 格式脱敏。
- 使用 DeepSeek Chat Completions，当前为非流式调用；工具方式依据 [DeepSeek 官方 Tool Calls](https://api-docs.deepseek.com/guides/tool_calls/)。回答按最新用户消息语言生成。
- 会话上下文在服务内存中，最多 24 条用户/助手消息，每条 8000 字符；重启服务会丢失。操作轨迹包含任务、工具回执及模型最终回答，保存在 `%LOCALAPPDATA%/CocosAgent/agent-runs/`；项目写入账本仍在 `.cocos-agent/operations/`。
- 模型最终文字不是编辑器回执。Agent 完全没有有效任务工具回执时，进行有限纠正，仍无回执则面板显示“任务未确认完成”并隐藏模型完成声明。这只防止本轮发现的无回执声明，不能视为对每句模型回答的语义真实性证明。

## 原生 skill 按需读取

- Creator 原生 Agent 启动时只载入基础 `cocos-agent` skill，并读取 `cocos://2x/skills/index` 元数据目录；任务技能正文不会一次性注入上下文。目录列出 2.4.15 技能名、用途、资源 URI、SHA-256 和已声明引用。
- 模型可按需调用只读 `cocos_2x_skills_list`、`cocos_2x_skill_read`、`cocos_2x_skill_reference_read`。正文和引用均从 Creator 扩展包内 MCP Resource 读取；Host 校验 package 名称/版本/指纹、资源 URI 与目录 SHA-256。引用只能按选中 skill 声明的 reference ID 读取。
- 轨迹记录目录哈希、包版本/指纹、skill 名称、引用 ID、URI、正文哈希、字节数与来源（启动基础 skill 或模型按需读取）；不复制 skill 正文、图片 Base64 或凭据到 JSONL。读取失败记录错误码且不产生项目副作用。
- 自动化集成测试使用确定性模拟模型走通“实例 → 能力 → 目录 → 场景组合 skill → 合同引用 → 场景快照 → 最终回答”，并断言轨迹能证明读取对象且没有技能正文。它验证了真实工具调度代码和 MCP Resource 合同，但不等同于真实 DeepSeek 的任务选择或 Creator 面板验收。
- Creator 安装运行时仍为 `cocos-agent-2x@0.3.0`，源码包已升级为 `0.3.1`；需更新运行时并重载 Creator 后，才能在面板中完成真实模型按需读取验收。

## 真实验收

过程证据见 [JSONL](traces/cocos-agent-assistant-2.4-deepseek-20261010.jsonl)。其中保留失败状态，不能把 `model.response`/最终文字当成已执行动作。

| 项目 | runId / 操作 | 结果 |
| --- | --- | --- |
| Ask | `0691f223-95d0-46b6-ae8f-f0fe6ae64293` | 只读场景与 Canvas，7 个原有子节点；场景 SHA 未变化 |
| Plan | `473b8310-e595-45ef-98fe-06ab2ae32f7a` | 只读实例/能力，中文步骤；没有写入 |
| Agent 拒绝 | `a41bfa18-8cf5-47c8-888a-e5db275cde6d` | 参数已显示，拒绝后 `write_not_approved`；没有新增节点 |
| 首次批准失败 | `603a8492-edc5-4f26-97f6-4509eaf40c18` / `c137d3bd-fbe9-4e89-a92b-00d6aadaac8e` | Windows fsync 报 EPERM，发生在编辑器写入前；保留全 pending 初始账本 |
| 按账本对账 | `14d4b9d9-91f0-4a02-8eed-49db23e2f4bf` / 同一失败操作 | 在面板批准 `operation.reconcile`；活动场景与磁盘共同确认无副作用，追加 `no-effect`/`recovery=passed`，没有重试写入 |
| 批准创建 | `75a7e52c-27ef-421e-a639-770f62493d34` / `862237a8-72d1-44ef-935c-34d695c665e0` | 实际创建 `AssistantAcceptanceTemp20261010`，编辑器、磁盘和独立节点读回通过 |
| 无回执完成声明 | `247fa9a1-5a5e-43af-9ae0-74b91dfe5ea8` | 模型未调用工具却声称补偿；runner 判为未完成。发现面板仍显示原文后修复隐藏逻辑，并加回归测试；该轮没有清理节点 |
| 真实补偿 | runId `3515cc54-479f-4504-828e-72299acb711e` / 操作 `b95dda19-ebe7-455d-bbb0-9f9f72392eaa`，来源为已创建操作 | 面板重新提交并批准，按来源 UUID 删除；账本 `completed/recovery=passed`，实时检查 `not-found`，磁盘无节点 |

成功节点 UUID 为 `89ZGYpS9hI8Ltmu/EIHiIz`，Canvas UUID 为 `a286bbGknJLZpRpxROV6M94`。空节点无需像素画面验收，`preview=skipped`；通过真实层级列表确认出现和清除，不冒称 Sprite/Web 预览已通过。

批准参数、节点创建与补偿画面：

- [批准前](traces/visual/assistant-2.4-approval-20261010.jpg)
- [创建后](traces/visual/assistant-2.4-created-20261010.jpg)
- [真实补偿后](traces/visual/assistant-2.4-compensated-20261010.jpg)

补偿后的场景 JSON 与测试前备份深度比较完全一致（21 个序列化对象、无临时节点）；Creator 保存改变了文本格式，随后只在语义一致检查通过后恢复原字节。最终 `helloworld.fire` SHA-256：

```text
8ae57957e06f0ed025f0e4886f9274f0a739969bef8b9a86dfef980b7a774e85
```

既有 `RepairRedA20261010` 节点、资源和未完成流水线均保留；没有对阻塞的资源流水线改用其他通道清理。

## 修复与自动测试

### 2026-10-11：Ask 查询与执行一致性、面板终态

- 用户在 macOS Creator 面板完成 Ask 后，轨迹显示能力目录可用，`scene.snapshot` 却被 `MCP_RUNTIME_UNREPORTED` 拒绝；服务已返回最终结果，面板仍保留“正在处理”。
- 根因分别为 MCP 执行请求未携带进程指纹、JSONL 子请求及 dispatcher 的 Catalog 调用未继续转发该指纹，以及面板结束请求时只解锁按钮、未更新本轮活动行。
- MCP 统一附加实际进程指纹，JSONL 保留到单命令与组合工作流子请求，dispatcher 将其传入执行前的两次 Catalog 查询。身份、合同及指纹不匹配的拒绝规则保持原实现。
- 面板按回执更新“已结束 / 待核对 / 等待批准 / 已停止 / 失败”，忽略其他 requestId 的结果；已结束不等于写入或预览已验收。
- MCP/Assistant 自动测试 **46/46**、JSONL/dispatcher **5/5** 通过，新增覆盖完整 JSONL → dispatcher → Catalog 转发、组合子请求与五类面板终态。Catalog 回环集成测试通过，包含缺失指纹与陈旧指纹的拒绝检查。
- 使用扩展内安装的本地运行时，真实 MCP stdio 查询实例、能力并读取 `helloworld` 场景成功（15 个节点）。场景 SHA-256 前后一致，见[只读回执](traces/cocos-agent-ask-runtime-fix-20261011.json)。这项独立桥接检查没有调用模型；随后另做 Creator 面板模型验收。
- 用户重启 Creator 后完成最终实机验收：Creator 原生面板使用 DeepSeek Flash Ask，顺序调用实例列表、能力目录、场景快照；三次回执均成功，最终 `run.stop=completed/model_final`，`allowWrite=false`。场景为 `helloworld`，15 个节点，哈希未变。面板正文与活动区显示只读任务完成，发送按钮和模式已恢复可用；完整轨迹在用户目录 `~/.local/state/CocosAgent/agent-runs/2026-10-11T01-23-52-882Z-c00d3f8d.jsonl`，摘要见上述只读回执。

### 2026-10-11：任务级 skill/引用读取

- MCP 技能目录补充用途描述；Creator 原生模型工具循环发现目录元数据，但只在模型按任务选择后读取技能正文和声明引用。
- 每次读取前核对扩展包版本、package fingerprint、skill/reference URI 和 SHA-256；读取轨迹记元数据，不记录正文或图片 Base64。启动注入的基础 skill 同样记录来源与 SHA-256。
- 产品技能说明改为 Creator 原生 Agent 的主路径，明确 sidecar/MCP 是 Creator 管理的内部实现；Codex MCP adapter 仅为可选外部入口。同步权威 skill 来源与包版本到 `0.3.1`。
- MCP/Assistant 全量自动测试 **47/47** 通过；确定性 Agent 循环和独立 Creator 扩展打包测试均证明按需读取 `cocos2-scene-composition` 及其合同引用，然后调用只读场景快照，并验证 JSONL 没有复制 skill 正文。技能包检查通过：**11 个技能、29 份引用**；`git diff --check` 通过。
- 仍缺 Creator 面板端到端证据：`2.4.15NewProject/packages/cocos-agent-bridge/assistant-runtime` 当前为 `cocos-agent-2x@0.3.0`，不含新 skill 工具，不能把自动化循环测试表述成已在面板中实测。需安装 `0.3.1` Creator 扩展包并重载后，用真实模型完成一个对应任务，再从 Creator 本机轨迹核对其实际选择与读取记录。

- 面板 IPC 改用 `messages`；主进程处理器接收 `(event, payload)`，统一消息名。连接失败恢复按钮、断线结束 busy/审批状态。
- Windows 操作账本以可写句柄执行 `fsync`，保留落盘检查。
- 对账仅新增严格的 **2.4 空节点初始记录**：零回执、六阶段全 pending、无组件/变换/Prefab/来源记录。必须证明同一父节点 UUID、活动场景目标缺席、磁盘目标缺席；不自动执行或删除其他账本。
- 修复工具回执包装、重复事件、模型并发工具纠正、无任务回执的面板完成声明；关闭 socket 取消待批操作。
- 调度测试中的 POSIX 固定路径改为 `os.tmpdir()` 绝对路径，Windows 目录链接使用 junction；这属于测试夹具适配，不扩大 3.x 产品范围。

2026-10-10 本轮增加 `.env.local` 凭据读写/自动恢复和结构化 Plan 步骤卡。真实 Ask 已在不重新输入 Key 的情况下回答活动场景；之后的真实 Plan 首次暴露 Host 读取工具回执层级错误，已修复并为成功/失败/缺失回执补充回归测试。修复后 MCP 目录 `npm test` 共 **30/30** 通过，`git diff --check` 通过；`.env.local` 命中根 `.gitignore` 的 `.env.*` 规则，未被跟踪。Plan 卡修复后的 Creator 面板实机复跑未完成：用户按下 Escape 停止了本轮 Windows Computer Use，因此不要把旧 Plan 轨迹表述成修复后的复验。

首轮验收还运行过 MCP 目录 `npm test`（20 项）、`operation-reconcile.test.js`（6 项）、`agent-dispatch.test.js`、`scene-node-create-contract.test.js` 和 `operation-store.test.js`；输出见[历史测试记录](traces/cocos-agent-assistant-tests-20261010.txt)。本轮自动测试扩展至 30 项并全部通过。真实 DeepSeek API、Creator UI 与 MCP stdio 实机测试记录在上表和轨迹中，不能用自动测试代替这些实际回执。

## 后续范围

尚未完成：流式回答、Markdown 渲染、聊天持久化/多会话、计划编辑、任务取消、上下文附件/选择对象引用、差异预览、全面 Unity 交互对齐。计划逐步执行尚待 Creator 实机与 DeepSeek 真模型端到端回归。Agent 当前的实机编辑操作只验收空节点和其恢复；资源、Prefab、构建和运行时虽有已有 Host 能力，需另按具体模型任务逐项验收。3.8 按当前项目范围暂停。

### 2026-10-11：现有 PNG 原生面板写入验收进行中

固定使用研究工程 `db://assets/resources/BlueReleaseOct09.png`，目标为 `helloworld/Canvas` 下临时 Sprite `NativePanelBlue1011`，位置 `(220,100)`、缩放 `(1,1)`。已真实在 Creator 面板输入并发送 Plan；没有用 harness 或外部 Codex MCP 替代面板入口。首次暴露研究工程内部 MCP 仍加载旧 `0.3.0` 的版本/指纹不匹配，更新运行包并通过 Package Manager 仅重载本工程扩展后，合同检查匹配。随后同一工程两个 Creator 实例交替连接导致 `CATALOG_CHANGED`；关闭已确认没有未保存标记的重复工程窗口后，只读查询恢复。

唯一实例中的真实模型已读取 `cocos2-mcp-tools@0.3.1` 和声明的 MCP 合同引用，并通过 PNG 搜索、场景快照和精确 Canvas 读回。模型将同名 PNG 搜索缩小至 `resources/BlueReleaseOct09` 后取得唯一有效结果；Canvas 使用快照返回的 `helloworld/Canvas` 路径。该轮默认 10 次模型调用在最终计划输出前耗尽，未生成可执行计划卡，也未写入场景。原生服务现明确使用 Ask 16 轮/14 工具调用、Plan 与 Agent 20 轮/18 工具调用的有界预算，保留每项写入审批。更新文件已同步到开发扩展内部 runtime，但锁屏导致扩展重载与下一轮实机验收仍待完成；自动测试 48/48 通过。

**后续证据校正：** 原生面板后来完成计划步骤执行和批准写入，操作 `b1d4c0e2-7f3a-4a91-9c58-2e6d10ab4f01` 的编辑器与磁盘读回通过，创建节点 UUID 为 `a608G6aX9MMb8CqUwqBqY4`。原生运行轨迹 `2026-10-11T05-18-40-878Z-42f3a026.jsonl` 包含实例、能力、批准后的 `scene.node.create` 与 `operation.get`。账本另有 05:20 UTC 的独立浏览器运行态读回：节点、SpriteFrame UUID、位置与缩放一致；这不是原生模型观察截图或视觉批准证据，也不证明场景重开。

09:54 UTC 再从原生面板续验时，发现扩展主程序为 0.3.4，但其内部运行包仍为 MCP 0.3.0 / skills 0.3.1，能力查询返回 `CAPABILITY_CATALOG_INVALID`，模型安全停止。保留旧 runtime 至 `/tmp/cocos-native-png-runtime-before-20261011-0958` 后，用当前打包器生成并替换研究工程的内部 runtime，再通过 Creator Package Manager 重载本扩展。09:57 UTC 原生 Ask 确认 extension 0.3.4 / MCP 0.3.3 / skills 0.3.2、合同 `matched`，并实际读取原操作、场景快照和精确节点；模型首次给快照传入不支持的 `targetNodeName` 被只读参数校验拒绝，随后用空输入成功读回，没有执行任何写入。

**整条任务仍未完成：** 场景重开、视觉验收、原生补偿、新 ID 重放及最终补偿尚缺证据。续验前场景 SHA-256 为 `414c5563d24778a815632f1c480bc8d243ceb978a311a56f26db49e28d96993a`，其中还包含已有按钮夹具；不得为恢复早期 SHA 而覆盖后来内容。桌面接口随后明确报告 Mac 锁屏，故尚未继续这些 UI 步骤。下一次必须沿原操作账本续验，禁止重复 apply。限量轨迹摘要见 [原生 PNG 任务验收记录](traces/cocos-agent-native-png-write-2.4-20261011.json)。

## 2026-10-11 原生按钮脚本续验

原生面板已完成真实 DeepSeek Flash skill 读取、精确差异批准、脚本 apply、原账本 reconcile 和 compensate；Creator 增量编译使用目的产物内联 source map，独立 map/stats 留旧缓存导致初次超时，严格校验修复重载后同 ID 对账通过。临时按钮位置独立记录并补偿，脚本/meta/场景均恢复本轮基线，原 PNG 节点保留。实际鼠标点击与画面/Console 的计数 1、2，以及脚本恢复后不再计数由 CUA 可见本地预览验证。原生 runtime_observe 只证明初始运行，其独立临时页面未观察点击后状态。新 ID 原生重放和真实错误修复待做；前述旧版本只读/分发状态为历史记录。见[脚本合同与验收](cocos-agent-script-development-0.1.md)。
