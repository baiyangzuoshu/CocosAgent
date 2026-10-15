# CocosAgent 最新本地版本复审（2026-10-15）

审核基线：`a0230a1b1a275c6e548a5258df561dedf1e44275`（main）。用户确认远端更新已同步到本地；本轮 Git fetch 因 GitHub 登录未完成而失败，连接器也无法访问该仓库，因此没有独立确认远端 HEAD。本报告仅对上述本地提交及当前工作区负责。

后续修复：本报告保留审核时结论；2026-10-15 的源码修复、回归结果和原生实机待验状态见 [执行流程修复记录](cocos-agent-execution-flow-repair-20261015.md)。

Creator 扩展为 `0.3.16`，MCP 包为 `0.3.3`。原有未提交报告 `cocos-agent-product-audit-20261015.md` 保留原样；它以 `a32c5af` 为基线，不能直接视作本次结论。

本轮没有修改产品源码、合同或测试，没有调用真实模型、读取真实凭据、操作 Creator、修改游戏资产或重放操作。运行了本机自动测试与使用模拟回执的离线复现。历史 Creator 验收记录与本轮离线证据分开使用。

## 产品判断

当前已经是具有独立运行链路的 **Creator 原生 Agent 原型**，适合继续做受控任务试用。暂不能承诺一般游戏功能的正确完成、跨 run 的可靠恢复或自动交互验收。

源码支持的原生链路是：Creator 面板 → 扩展管理的 Node Assistant Host → TS Agent → Host 管理的 MCP 子进程 → 受限命令 → Creator 编辑器桥接。扩展从自身 `assistant-runtime` 启动 Host；没有启动 Codex 进程的依赖。内部使用 MCP 不影响原生产品定位。安装机仍需 Node.js 20+、模型接入和有效工程扩展包。

与旧报告相比，应承认以下实际进展：

- `78853a1` 移除了 Codex 插件/MCP 注册入口，Creator 技能仍从产品目录打包。
- `234c42b`、`bc084fe` 增加语义摘要、Provider 超限重试、显式批准的工程记忆合并及相关测试；本轮 runtime 75/75 通过。
- `a0230a1` 增加只读任务细分条件，并让本轮 Host 预检回执参与精确工具名的验收。不能继续说“没有修复只读收尾代码”；但识别仍有缺口，且升级后原生重验未收口。
- `a32c5af` 已把批准计划接入业务验收，并修正 Prefab 改名后的预期路径。旧报告中“未接入”“仍只比较旧路径”的结论不适用于当前源码。
- 原生迁移记录证明了当时 macOS 工程的安装包升级和新版 skill/reference 读取。它同时明确记录：升级后只读收尾仍受旧门槛影响；最新修复安装后因 Creator 登录页阻塞，未产生重验任务。这不等于当前版本完整实机通过。

## 主要问题

### 1. [P1] 不确定写入恢复状态没有跨 run 继承

位置：`tools/cocos-agent-runtime/src/creator-policy.ts:173–181`、`:225–240`；`tools/cocos-agent-bridge/mcp/assistant-host.mjs:467–495`。

`createRunPolicy()` 每次重置 `recoveryOnly=false` 与 `pendingIdentity=null`。Host 新任务入口只限制正在运行的任务，没有把最近未对账操作传入新策略；持久会话把中断写入标成 `needs-review`，但该显示状态没有成为工程级新写入门槛。逐项操作账本仍能保护各自操作，不能替代工程级未决恢复约束。

离线复现：同一 policy 工厂第一轮收到 `sideEffect=unknown` 后，只剩 recovery 工具；创建第二轮后，`recoveryRequired()` 变为 false，普通写工具重新出现。没有发出真实项目写入，因此不能据此声称已造成损坏。

建议：工程隔离持久化未决操作身份，在 Host 启动、新 run、实际写入前共同检查；只有原 operationId 的明确终态对账才能解除，不能依赖最多 24 条的最近运行列表。覆盖同会话下一轮、新会话、Host 重启、错误 ID 和状态写入失败。

### 2. [P1] 业务验收只校验操作与读回自洽，未绑定用户指定的最终值

位置：`tools/cocos-agent-runtime/src/creator-task-acceptance.ts:55–94`、`:146–180`、`:214–217`；`tools/cocos-agent-bridge/mcp/structured-plan.mjs:96–98`。

自由任务只从文本派生 read/write/runtime 等通用条件；目标读回与本轮工具回执里的 `expectedDiff.after` 比较，没有与用户指定目标独立比较。计划 `acceptance` 目前也只允许 `kind`，没有可执行的目标身份或预期值，`validation` 仍是文本。

离线复现：用户任务为“将 node-1 的 x 移动到200”，提供真实格式的 apply/账本/实时读回证据，三者一致证明 x=20，验收仍返回 `satisfied=true`。这证明当前校验可阻止旧读回和内部不一致，但不能证明业务目标正确。单次写入批准仍存在，本复现没有绕过批准或执行真实操作。

建议：在可审阅的执行合同中固定目标 UUID、属性和值、必要运行断言及其来源；模型应依据合同执行，最终比较必须使用合同的预期值。无法绑定的任务保持待明确或部分完成，避免把回执自洽呈现为整项目标完成。

### 3. [P1] 当前回归入口仍有大量失配，不能作为发版全绿门槛

位置：`tools/cocos-agent-bridge/mcp/structured-plan.test.mjs:5`、`assistant-plan-panel.test.mjs:10`、`mcp-server.test.mjs:39`、`:80`；`tools/cocos-agent-runtime/test/context-compact.test.mjs`。

本轮 runtime 75/75，MCP/扩展 63/90。MCP 的 27 项失败分类如下：

| 原因 | 项数 | 判断 |
| --- | ---: | --- |
| Plan v1/缺少 v2 acceptance 的旧夹具 | 12 | 正向测试在进入目标逻辑前失败；不是证明 v2 正向流程可靠 |
| DOM mock 缺少 querySelector | 9 | 测试桩失配，不能据此声称真实 Creator 面板损坏 |
| 固定技能包版本仍期望 0.3.2 | 3 | 当前返回 0.3.3；部分同组断言还固定旧技能数量 |
| 观察器旧参数/身份夹具 | 1 | 未跟进 projectRoot/instanceId 等接线 |
| Windows POSIX mode 断言 | 1 | 不能以 POSIX mode 数值证明或否定 Windows ACL |
| Windows symlink 权限限制 | 1 | 本机环境未满足该测试前提 |

新增 Provider 超限测试只让第一次请求失败、第二次无条件成功，没有验证第二次使用更小预算或更短请求，所以遗漏了问题 4。当前批准计划验收模块也缺少直接覆盖其关键跨步骤行为的测试。

建议先同步 v2 正向/拒绝/跨步骤/恢复测试，修正 DOM 与接线夹具，按发布清单验证包版本；为平台专属测试明确运行前提。不能通过删除安全校验或放宽业务完成条件换取全绿。

### 4. [P2] 超限重试中的语义摘要重新使用原预算，可重复发送相同请求

位置：`tools/cocos-agent-runtime/src/agent-loop.ts:189–197`、`:238–246`。

重试先用 `reducedBudget` 准备上下文，再调用 `summarizePrepared(retry)`；但函数内部重新 `prepareAgentContext({ ...contextInput, dialogueSummary: summary })`，其中 `contextInput` 携带原始预算。原请求若在原预算内，重新准备会直接返回未压缩历史，从而丢失重试预算。

离线复现：本地预算 4000，首次请求估算 3595 tokens；模拟 Provider 返回超限后，降预算本应为 2600。语义摘要调用一次，实际第二次仍发送完全相同的 3595 tokens 消息，随后以 `provider-context-limit-retry-exhausted` 停止。没有调用真实 Provider。

建议摘要阶段显式继承当前准备阶段的预算；重试预算应在后续本 run 中保留，除非有明确调整。测试断言实际发送的消息/估算值及有效预算，覆盖原预算内、降预算后需压缩、摘要失败和重复超限。

### 5. [P2] apply 后再 compensate 的组合任务始终缺少 content-written

位置：`tools/cocos-agent-runtime/src/creator-task-acceptance.ts:58`、`:76–80`、`:197–199`。

任务文本一旦含“补偿/恢复”，所有内容写入都必须满足 restoration 条件。正常的中间 apply 因 action 不是 compensate，导致 `attempts.every(...)` 永远为 false。

离线复现：“将节点临时移动20像素，再补偿恢复原位”，提供顺序正确的 apply、compensate、两个写后账本和同 UUID 最终 x=0 读回，只有 `content-written` 未满足。计划最后一步合并前序写入时也会使用同类整项任务条件。

建议按目标和源/补偿 operationId 验证状态转换，允许合法中间 apply，最后检查预期恢复状态；保留每次操作的保存、账本和恢复证据要求。

### 6. [P2] 只读识别仍有误判和漏验，不能把本次修复视作完整收口

位置：`tools/cocos-agent-runtime/src/creator-task-acceptance.ts:30–51`、`:62–71`。

两组离线复现：

- “只读查看场景，不写入、不审批、不预览”仍派生 content-written、账本、目标读回和 runtime 条件，因为否定删除规则不识别这些普通“不…”措辞。这是误加门槛，不是绕过写入批准。
- “读取场景快照，并读取 HelloWorld.js 检查脚本内容”仅生成 `requested-scene-snapshot`；只有场景快照回执、没有脚本读取，也返回 `satisfied=true`。`explicitReads` 非空后替代通用内容条件，未覆盖的请求被遗漏。

建议将只读清单转为保守、可审阅的结构化目标；每个对象/资源读取都有独立条件，未识别的分句不能静默丢弃。至少补上述中文否定、多项异类读取及同类不同对象测试。

## 仍需实机或产品补齐的边界

- **预览实例归属：** `runtime-observation.js:11` 固定连接 7456；页面证明场景名/UUID，`:423` 的 instanceId 来自 Host，`:438` 再回填到结果。复制工程可保留相同场景 UUID，因此当前观察不能独立证明端口属于指定工程/实例。这是静态确认的身份缺口，本轮未实机故障注入。需要 Creator 可信入口或运行时返回与工程/实例/启动代次绑定的身份。
- **同页观察已有实现：** 不再沿用“每次必定新开临时页”的旧结论。当前已有持久预览会话、页面关闭/导航检查及内容修改后刷新门槛；完整 Windows/Creator 原生交互复验仍缺。
- **凭据文案仍不准确：** `panel/index.js:407` 显示“本机加密凭据”；`credential-store.cjs:63`、`:103` 实际是用户目录 `credentials.env` 明文文件与文件权限尝试。应修正文案；若要提供加密承诺，需系统安全存储及平台权限验证。本轮没有读取真实 Key，没有证据表明发生泄漏。
- **实际开发覆盖：** `script-contract.js:9` 仍限已有 `.js`；节点 create 最多一个 Sprite/Label，patch 白名单没有通用组件、事件与对象引用绑定。TS/脚本创建挂接、功能相关内容检索、完整 UI 工作流仍需由真实任务补齐。
- **交互验收：** `creator-task-acceptance.ts:194` 对 `creator-interaction` 明确返回 false，是诚实的未支持边界。不能为完成任务而删除该门槛；需要实际输入及业务结果断言工具。
- **连续使用：** 记忆合并具备逐条 revision 读取门槛、审批、来源并集、CAS 和 tombstone 实现与离线测试；原生审批、跨 Host 重启召回、取消中的写入对账、压缩证据取回仍需分别实测。

## 本轮检查结果与证据

环境：Windows，Node `v24.15.0`。TEMP/TMP 指向工作区外的本任务可写产物目录，避免把沙箱默认临时目录问题混入产品结论。

| 检查 | 结果 |
| --- | --- |
| runtime `npm test`（包含 TS 编译） | 75/75 通过 |
| MCP/扩展 `npm test` | 63/90 通过，27 失败，分类见上 |
| 场景、Prefab、脚本、恢复及目录合同选定回归 | 23/25 通过；1 项因 Windows symlink 权限失败，1 个目录合同文件因缺少暂停范围的 3.x dist/main.js 无法加载；不新增/构建 3.x |
| 上游原始字节哈希校验 | 失败；core.autocrlf=true，18 份工作区文件 LF 规范化后全部匹配清单 SHA-256；未据此声称上游源码被篡改 |
| 离线故障/验收探针 | 确认跨 run 锁重置、目标值漏验、重试请求重复、组合恢复误拒绝和只读两类识别问题 |
| Creator/模型/项目运行验收 | 本轮未执行 |

建议给只读上游归档设置明确的换行策略，保证按字节校验在 Windows checkout 中也可重复，不应静默放宽校验器。

本机离线复现与日志保存在 `C:/Users/Administrator/.codex/visualizations/2026/10/15/01a13d40-c1ed-7c23-a12f-ab4e0c921986/`：`audit-probes.mjs`、`audit-probes.jsonl`、`runtime-test.log`、`mcp-test.log`、`bridge-test.log`。它们不包含真实模型凭据。仓库没有现成 graphify 图谱，本轮代码结论来自直接源码阅读与程序复现。

## 推进顺序

1. 工程级跨 run/重启恢复门槛，与绑定明确业务目标的验收合同。
2. 恢复可用的 v2 回归门槛，同时修复超限重试、组合恢复及只读识别。
3. 修正文案、补预览实例归属；在独立 Creator 2.4.15 工程完成当前版本只读收尾、计划、Prefab、同页观察及连续使用验收。
4. 选择一个真实游戏功能，按“命令合同 → 编辑器桥接 → 产品 skill → 原生实机验收”补内容检索、TS/组件/绑定和实际交互结果证据。

不把通用 shell、团队/子 Agent、定时任务或新增 3.x 列为本产品补齐目标；不重复 apply/replay 历史保留节点，不绕过原账本恢复。
