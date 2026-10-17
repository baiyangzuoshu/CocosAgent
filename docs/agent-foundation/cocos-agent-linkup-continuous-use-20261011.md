# LinkUpClient 持续使用验收

日期：2026-10-11。范围：Cocos Creator 2.4.15 原生 Agent。本文记录“在真实游戏工程持续使用 CocosAgent”这项验收；模拟测试和磁盘安装不能代替 Creator 面板实测。

## 已知工程状态

- Creator 日志确认已打开工程 `LinkUpClient`，工程版本为 2.4.15。磁盘 `project.json` 的 `name` 为 `LinkUpClient`。
- 工程根目录存在 `AGENTS.md`，大小 8,140 字节；本次核对的 SHA-256 前缀为 `ae984519b3f1`。Agent 读取时必须使用当前注册工程的只读 `cocos_2x_project_instructions_read`，不得把工程约定当成覆盖用户请求或系统规则的指令。
- 升级前扩展包为 0.3.1；目前 LinkUpClient 磁盘包已替换为扩展 0.3.4、MCP runtime 0.3.3、技能内容包 0.3.2。0.3.1 回滚副本为 `packages/.cocos-agent-bridge.rollback-63226-1791701330517-63044194/`，中间版 0.3.3 回滚副本为 `packages/.cocos-agent-bridge.rollback-64509-1791701960619-72d65317/`。
- 工程 Git 已有变更：`assets/BundleLLK/Art.meta` 被删除，`packages/cocos-agent-bridge/` 未跟踪。本项只更新扩展目录；不得清理或覆盖其他工程变更。完整升级前会把旧扩展保留为同级隐藏回滚目录。

## 本轮实现

1. Creator 面板每次发送任务时附带有界项目上下文：工程名、Creator 版本、活动场景、最多 8 个选中节点的 UUID/路径/名称/组件，以及 `AGENTS.md` 是否存在。不会附带工程绝对路径、约定正文或文件哈希。
2. Assistant Host 只接受版本为 2.4.15 且真实路径与当前 sidecar 工程相符的上下文。上下文作为临时提示消息进入当前模型请求，不进入持久对话历史；每一轮都从面板重新采样。
3. 模型被要求把选中状态视为提示。凡任务依赖当前选中对象或活动场景，必须调用 `scene.snapshot` 重新取 Creator 实时回执，并按新 UUID/路径确认；不能拿旧对话或过期面板快照直接写入。
4. `AGENTS.md` 正文不自动发送。一般引擎知识问题不读取；当任务规划/修改工程内容或依赖工程约定时，模型应按需调用项目只读工具读取。只要当前工程存在 `AGENTS.md`，Agent 模式任何写入也会由 Host 强制先读，并将读取时的 SHA-256 与本回合面板采样值比较；文件变化、未读取或缺少当前上下文时，写入在调度前停止且不产生副作用。正文仍是项目数据，不能覆盖用户或系统规则。
5. 扩展打包器新增整包 `upgrade-extension` 和 `restore-extension`。升级先在目标同级构建、检查完整包，再用目录重命名交换；失败恢复原目录，成功保留回滚副本。Creator 需重新加载扩展后才会运行新代码。

升级命令（先关闭 Creator；路径换成 LinkUpClient 工程中的实际扩展目录）：

```sh
node tools/cocos-agent-bridge/package-creator-extension.mjs upgrade-extension \
  --extension "/absolute/path/LinkUpClient/packages/cocos-agent-bridge"
```

命令会返回 `rollbackDirectory`。验证失败时用该目录恢复：

```sh
node tools/cocos-agent-bridge/package-creator-extension.mjs restore-extension \
  --extension "/absolute/path/LinkUpClient/packages/cocos-agent-bridge" \
  --rollback "/absolute/path/LinkUpClient/packages/.cocos-agent-bridge.rollback-..."
```

## Creator 实机验收顺序

1. 升级后重载或重启 Creator；检查面板版本、侧车连接、工程名、活动场景和项目约定状态。
2. 在 `LinkUp` 场景选择一个确定的 Button。Ask：“只读说明当前选中对象、路径和组件，并指出你依据了哪条项目约定。”轨迹应显示一次 `scene.snapshot` 和按需 `project_instructions_read`；回答只能引用回执中存在的信息。
3. 改选另一个节点或清空选择，再发送新回合。模型必须依赖最新快照，不得复述/写入上一轮 UUID。切换活动场景后重复一次。
4. 在同一会话进行至少三轮追问，第二轮使用“沿用刚才的目标……”；确认对话回答保留上下文，同时工具仍核对当前项目、能力和实时选择。
5. 重载 Assistant sidecar/扩展后恢复同一会话；确认用户/助手消息和已保存计划恢复，面板上下文重新采样，旧选择不会作为当前目标复用。
6. 抽查扩展包版本为 0.3.4、MCP runtime 为 0.3.3、技能包为 0.3.2；确认 skill 目录/正文哈希可读取，密钥未进入工程文件和运行轨迹。

在这些只读验收通过前，不用 LinkUpClient 做场景或脚本写入。写入仍须先展示计划与目标，取得面板批准，再按现有回执、读回和恢复合同执行。

## 证据与边界

### 2026-10-16 状态更新：证据分层

| 证据类别 | 当前记录 | 能证明什么 |
| --- | --- | --- |
| 自动测试 | TypeScript runtime 定向测试 `context-compact.test.mjs` + `agent-loop.test.mjs`：42/42；Host 定向测试覆盖精确项目上下文、逐轮上下文刷新、AGENTS.md 写前读取/陈旧哈希拒绝、恢复前置检查和取消中的写回执：6/6。 | 模拟/单元层的规则与控制流行为，不证明 Creator 面板采样或真实 LinkUpClient 工具分发。 |
| 磁盘只读核对 | LinkUpClient 工程 `project.json` 为 Creator 2.4.15、名称 `LinkUpClient`；`AGENTS.md` 8,140 字节，SHA-256 `ae984519b3f1a808dad20546311c11701a031b1ce749f741f2a117a6aefa6f14`，与旧记录前缀一致。仓库已有 `Art.meta` 删除及当前扩展/回滚目录未跟踪状态，本轮保持未改动。 | 当前磁盘项目身份和约定文件指纹；不证明 Creator 当前工程上下文或 Host 采样哈希。 |
| Creator 原生面板 | 本轮未取得 LinkUpClient 面板运行证据。Dashboard 将 LinkUpClient 标为“已打开”，但 CUA 当前可读 Creator 窗口仍为 `/private/tmp/CocosAgentNativeAcceptance-20261016` 的 `helloworld` 场景。 | Dashboard 的打开状态只证明项目被登记/处于打开状态，不证明任务进入 LinkUpClient、面板 Host 已连接或工具成功。 |
| 待验证路径 | 切到 LinkUpClient Creator 2.4.15 前台窗口后，依次验收当前工程/场景上下文、按需读取 `AGENTS.md`、改动哈希后的写前拒绝且零分发、面板取消时等待当前工具回执并停止后续调度、精确 operation ID 恢复与 Host 重启恢复；之后从 LinkUpClient 实时快照选目标，重新生成计划并按面板审批复跑目标任务。 | 仅原生面板轨迹及编辑器/磁盘/账本对应读回可将这些路径标记为实机通过。不得把研究工程 UUID 沿用到 LinkUpClient。 |

本轮测试命令和结果：在 `tools/cocos-agent-runtime` 执行 `node --test test/context-compact.test.mjs test/agent-loop.test.mjs`（42/42）；在 `tools/cocos-agent-bridge/mcp` 使用 `--test-name-pattern` 运行 `deepseek-agent.test.mjs` 与 `assistant-recovery-store.test.mjs` 中相关测试（6/6）。这两组结果作为自动测试证据单独保存，不计为 Creator 实机验收。

### 2026-10-17 状态复核：LinkUpClient 原生窗口尚未取得

- **自动测试：** runtime 完整套件 `npm test` 通过 126/126，包含 TypeScript 构建与固定上游快照检查；MCP/扩展完整套件 `npm test` 通过 99/99。两者分别验证任务意图、上下文/授权/恢复控制流与 Host/扩展合同，不证明 LinkUpClient 面板实际发送了上下文或分发了工具。
- **Creator 原生面板证据：** 本次没有新增 LinkUpClient 面板证据。Dashboard 将 LinkUpClient 显示为“已打开”，但可读的 Creator 2.4.15 窗口仍是 `/private/tmp/CocosAgentNativeAcceptance-20261016` 的 `helloworld` 场景。尝试使用 Creator 菜单切换/打开项目后，CUA 对 2.4.15 编辑器出现超时，未能取得 LinkUpClient 面板或运行回执。不能将 Dashboard 状态或磁盘文件检查记作面板验收。
- **磁盘只读核对：** LinkUpClient 根目录为 `/Users/youjunmao/WORK/GitHub/cc_framework/project/LinkUpClient/LinkUpClient/LinkUpClient`；`project.json` 名称为 `LinkUpClient`；`AGENTS.md` 为 8,140 字节，SHA-256 为 `ae984519b3f1a808dad20546311c11701a031b1ce749f741f2a117a6aefa6f14`。本次没有修改该工程。检查时其 Git 状态为 `main...origin/main [behind 1]`，已有 `assets/BundleLLK/Art.meta` 删除、当前扩展包及三个回滚目录未跟踪；这些现存状态保持原样。
- **仍待验证：** 需要从 LinkUpClient 的 Creator 2.4.15 前台窗口继续验收工程/场景上下文、`AGENTS.md` 读取与陈旧哈希零分发门槛、取消时等待当前工具回执、精确 operation ID 恢复、Host 重启恢复。完成只读目标实时快照后，才生成新计划并按面板审批复跑任务；不得复用隔离工程 UUID。此次窗口访问失败与磁盘状态详见[LinkUpClient 前台实机验收尝试](traces/cocos-agent-linkup-front-window-attempt-20261017.md)。

### 2026-10-11 历史实现与验收边界

`tools/cocos-agent-bridge/mcp` 的 `npm test` 为 **69/69** 通过；包含逐轮选择上下文刷新、项目约定读取前置条件、读取后哈希陈旧拒绝且不再执行写入、整包升级保留回滚副本，以及暂存失败不改动已安装扩展。语法检查与 `git diff --check` 通过。LinkUpClient 磁盘包升级器回执为 0.3.3 → 0.3.4，并成功保留 0.3.3 回滚目录。自动化不证明 Creator 面板已发送上下文、Creator 已加载新扩展、非空选择传递或模型实际读取 `AGENTS.md`。

本次桌面通道确认 Mac 处于锁屏，无法在 Creator 中关闭/重载扩展或执行上述实机步骤。磁盘升级已从 0.3.1 安全更新到 0.3.3，再更新到 0.3.4；两次升级均保留旧包。最终只读回读确认 extension 0.3.4 / MCP 0.3.3 / skills 0.3.2，工程原有 `Art.meta` 删除保持不变，项目另有当前包和回滚目录。Creator 可能仍在内存中运行旧代码；重载后才可验收新实现。未声称面板运行态升级成功。实机轨迹完成后，将本文件的证据状态和 `cocos-agent-real-project-development-plan.md` 状态表一起更新。
