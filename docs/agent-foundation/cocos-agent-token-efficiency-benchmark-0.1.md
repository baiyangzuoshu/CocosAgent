# CocosAgent Token 效率配对基准 0.1

日期：2026-10-30。状态：**已有 R1 单次预实验；当前 CocosAgent 尚未低于通用工具基线，目标未达成。** 本文针对当前第三方产品链路：Cocos Creator Agent CLI、其 MCP server、Creator 扩展和随 CLI 分发的 Skills。Creator 原生 CocosAgent 已停止并从仓库移除，不纳入当前产品结论。

## 待验证的产品假设

在同一 Creator 代码任务、工程快照、模型和 Host 配置下，使用 CocosAgent CLI 与按需加载的 Creator Skills，可以比 Codex 通用文件/终端工具用更少的模型 Token 达成同一结果。

唯一优化指标是完成同一任务所需的 Host/Provider 实际总 Token。结果一致性只作为配对样本纳入比较的前提，不另算完成率、返工率或质量分。CLI 提供领域工具和任务知识，不是独立模型；工具调用次数、Skill 文件字节数或上下文 JSON 字节数都不能替代实际 Token。

## 当前可用证据和缺口

- 当前 CLI 状态：本机 `cocos-creator-agent-cli` 版本 `1.1.1`；支持 Creator `2.4.x`。
- 当前编辑器状态：Agent 桥接返回 `instances: []`；Cocos Dashboard 可见 Creator `2.4.15` 已安装于 `/Applications/Cocos/Creator/2.4.15/CocosCreator.app`，但 `CocosCreator` 当前未运行。Dashboard 当时停留在安装版本页，未核实任何 Creator 项目名称、路径或打开状态，因此没有打开项目或调用项目工具。
- 当前 CLI 命令目录返回 `104` 条命令。此前当前 Codex Host 暴露 `101` 个 Cocos MCP 工具，其工具元数据描述合计 `47,742` 字符；这是优化前本机工具注册表计数，不是模型实际收到的 Token 数。源码现已改为默认只暴露 `cocos_tools_select`，按任务只暴露选定组；隔离 CLI 的一次 Provider Token 实测列于下文，但桌面 Host 尚未重载，当前会话仍显示旧的 `101` 项。
- 静态源码 [`mcp/server.mjs`](../../cocos-creator-agent-cli/mcp/server.mjs) 现在会按路由选择的 `project`、`assets`、`scripts`、`scene`、`prefab`、`runtime`、`extensions`、`vcs`、`cloud`、`tasks` 工具组裁剪固定工具，并仅在选中相应组时发现项目扩展和运行时 Provider。此实现说明了减少 Host 工具 Schema 上下文的机制，工具数、描述字节数和 Schema 字节数都不能替代实际 Token 节省结果。
- 对照组已按用户决定固定为 Codex 通用文件/终端工具，不加载 Cocos 专属 Skills 或 MCP。故第一批只测两组都能通过文件/终端完成的 Creator 源码任务。
- 已有 [CocosAgent Token 用量记录](cocos-agent-token-usage-0.1.md) 的真实配对样本来自 2026-10-18 的 **Creator 原生 Agent**。其中“技能目录/正文读取”同文本样本报告输入从 `99,649` 降到 `11,223`，但比较对象是原生 Agent 的历史策略，不是现行 CLI/Skills 对 Codex 通用文件/终端工具；不能作为本假设的证据。
- 已有 CLI/Skill 验收记录验证过 CLI/MCP 与 Skills 安装/调用链路；当前同任务 Token 预实验列于下节，尚未满足三组配对要求。
- Codex 的全局用量限额不是任务级账本；配对必须取得逐请求 Provider usage，并纳入完成该任务期间的重试、摘要与澄清请求。
- R1 的 `codex exec --json` 已返回完整 `turn.completed.usage`。默认沙箱曾因本地 app-server/Bridge socket 限制而失败；这些失败不计样本，获得本机 socket 执行权限后采集的完整运行才纳入下表。

## R1 单次预实验

固定任务：修复 `PlayerController.js` 的 `update(dt)`，保留正常正值移动、忽略负值或非有限 `dt`、将正值上限设为 `0.1` 秒，并通过 `node --test test/PlayerController.test.js`。各次均从相同测试夹具开始，独立测试均为 `3/3` 通过；模型 usage 取 Codex `turn.completed.usage` 的输入与输出总和，缓存输入已包含在输入 Token 中。

| 配置 | 输入 Token | 输出 Token | 实际总 Token | 与通用基线相比 |
| --- | ---: | ---: | ---: | ---: |
| Codex 通用文件/终端基线 | 66,889 | 864 | **67,753** | — |
| CocosAgent，动态选择 `scripts` 工具组 | 198,742 | 5,782 | **204,524** | 多 136,771（3.02 倍） |
| CocosAgent，优化前 101 工具目录 | 206,154 | 3,648 | **209,802** | 多 142,049（3.10 倍） |

单次样本中，动态工具选择比旧 101 工具目录少 `5,278` 总 Token（约 `2.5%`），但比 Codex 通用工具基线多 `136,771`。因此，Host 工具目录裁剪降低了同产品旧配置的实际用量，却**没有**证明 CocosAgent 已达到唯一目标。该结果仅作方向性预实验，不构成稳定结论；仍需至少 3 组随机顺序配对，并继续减少技能/工作流额外开销。

本轮为单组件脚本补充了 source-only 路径以减少无关工作流。尝试在隔离副本中重跑该改动时，Codex CLI 在模型请求启动前退出，未产生 JSONL usage；这次不计入样本，source-only 路径的 Token 影响仍待实测。

## 配对条件

| 项目 | CocosAgent 组 | 对照组 |
| --- | --- | --- |
| Host 和模型 | 固定同一 Codex Host、模型版本和采样设置 | 完全相同 |
| Cocos 能力 | 固定版本的 CLI 与任务所需 Skills；仅当任务两组都能完成时使用 MCP/Creator 工具 | Codex 通用文件/终端工具，不加载 Cocos 专属 Skills 或 MCP |
| 工程 | 每次运行从同一干净快照复制；分别重置状态 | 同一快照及重置规则 |
| 用户任务 | 字面相同的任务文本和验收条件 | 完全相同 |
| 历史上下文 | 冷启动会话；只提供同一份任务上下文 | 完全相同 |
| 重复次数 | 每项任务至少 3 组配对，运行顺序随机 | 与 CocosAgent 组逐项配对 |

任务必须落在两组共同可达的能力范围内，并以同一预定义最终状态作为入组门槛。若一组没有完成相同结果，该对样本标为不可比，不拿它计算 Token 节省。当前通用文件/终端基线不具备 Creator 编辑器工具，因此第一批只选可用文件/终端完成并能独立核验的 Cocos 源码任务；不把场景、Prefab 或预览任务混进这组对照。

## 任务集

第一批覆盖只读理解和 Creator 脚本源码修改，避免只用“列出技能目录”这类窄任务。每项任务固定输入快照、任务文本、目标状态、可用操作和独立核验命令/步骤。

| ID | 类别 | 相同结果的确认方式 |
| --- | --- | --- |
| R1 | Cocos 2.4.x 脚本缺陷定位与修复 | 相同固定测试/断言通过，最终源码差异符合预定目标 |
| R2 | Creator API 或项目源码诊断 | 同一组源文件事实与版本边界结论通过预先写定的核验表 |
| R3 | 多文件脚本功能改动 | 相同行为断言与目标文件差异通过独立检查 |

Creator 编辑器、场景、Prefab 或运行时任务只有在对照组也具备等价 Creator 工具时才可另行配对；缺少 Creator 实机时，不用静态源码结果代替编辑器或运行时验收。

## 计量和判定

- **唯一指标：** 汇总每项任务开始至双方达到同一核验结果为止的每个模型请求 Provider `total_tokens`，比较配对总量。输入、输出、缓存命中、请求数和 usage 覆盖率只作 Token 账本明细，不作为独立绩效指标。
- **结果一致门槛：** 由固定测试、源码差异或同一预写核验表确认两组得到相同任务结果。任一方没有完成或 usage 不完整时，该对标为不可比，不纳入省 Token 结论；不另行比较成功率或返工率。
- **用量范围：** 任务提示、技能路由/正文、工具 Schema、任务理解、主循环、摘要、重试和澄清请求均计入。缓存 Token 已包含在输入和合计内，不重复相加；缺失 usage 标未知，不按字节推算或补零。
- **归因限制：** 固定模型、Host、工程状态和任务文本。上下文字节、工具 Schema 字节和本地模拟只能解释机制，不能替代实际 Provider usage。

配对 Token 降幅按 `((Codex 通用工具 Token - CocosAgent Token) / Codex 通用工具 Token) × 100%` 计算。只对结果一致且实际 usage 完整的配对样本作结论；样本数和逐项 Token 一并报告。

## 结果记录表

| 任务 ID | 配对轮次 | 组别/配置 | 模型 | 结果一致 | 输入 Token | 输出 Token | 总 Token | usage 完整 | 独立核验 |
| --- | ---: | --- | --- | --- | ---: | ---: | ---: | --- | --- |
| R1 | 预实验 1 | Codex 通用文件/终端 | 同一 Codex CLI 模型 | 是，3/3 | 66,889 | 864 | 67,753 | 是 | Node 独立测试 3/3 |
| R1 | 预实验 1 | CocosAgent 动态 `scripts` 组 | 同一 Codex CLI 模型 | 是，3/3 | 198,742 | 5,782 | 204,524 | 是 | Node 独立测试 3/3 |
| R1 | 预实验 1 | CocosAgent 优化前 101 工具 | 同一 Codex CLI 模型 | 是，3/3 | 206,154 | 3,648 | 209,802 | 是 | Node 独立测试 3/3 |

## 执行门槛

1. 准备可复现的 Creator 2.4.15 源码隔离样本；如任务要打开 Creator，再先在 Dashboard 核对工程身份。
2. 固定 Codex 通用文件/终端工具基线、Host、模型和请求 usage 来源。
3. 从任务集挑选小批任务，先验证两组都能从同一干净快照运行，且验收与用量采集能对上任务 ID。
4. 再运行至少 3 组随机顺序配对；保存脱敏的逐请求 usage 和独立结果核验回执。
5. 汇总配对结果，注明失败、未知 usage、样本差异和不可外推的范围。

