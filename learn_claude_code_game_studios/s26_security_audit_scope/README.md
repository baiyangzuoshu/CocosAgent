# 第 26 课：安全审计的范围与证据

**目标：** 追踪 CCGS `/security-audit` 如何依据引擎、平台范围、扫描面和已知发现给出有边界的发布建议。

完成本课后，你应该能：

1. 区分 `platform.online` / `platform.multiplayer` 缺失与明确设为 `false`。
2. 按所用引擎选择有来源的扫描模式，识别 `NOT ASSESSED` 与零命中的区别。
3. 说明六类安全审计内容、报告等级和 `CLEAR TO SHIP` 的限制。
4. 追踪安全审计报告如何进入 Polish → Release gate，以及用户确认写入的边界。

## 问题

一款游戏扫描不到网络 API，也没有发现硬编码密钥，是否就可以说安全？如果项目没有配置引擎或网络范围，扫描模式又是照着错误引擎抄的，零命中没有证明力。本课从 `/security-audit` 学习如何证明审计实际覆盖了哪些攻击面。

## 源码位置

路径相对于 `engine/Claude-Code-Game-Studios/`：

| 文件 | 本课观察点 |
| --- | --- |
| `.claude/skills/security-audit/SKILL.md` | 审计模式、配置范围、引擎专属 pattern、六类检查、报告判定及 Gate 接入 |
| `.claude/agents/security-engineer.md` | 协作审查、严重度、威胁域、数据隐私和升级边界 |
| `.claude/hooks/yaml-helper.sh` | 读取项目配置标量并保留 unset 与显式值的区别 |
| `.claude/docs/code-root-resolution.md` | 代码根解析规则和不可扫描时的报告方式 |
| `.claude/docs/engine-reference/` | 核对引擎版本及可引用的 API 名称来源 |
| `studio-tests/agents/qa/security-engineer.md` | unset 网络范围、引擎 API 和安全/性能取舍的 Agent 测试案例 |

## 审计前先确定范围

`/security-audit` 支持 `full`、`network`、`save`、`input`、`quick`；不带参数按 `full` 处理。`engine.name` 和 `engine.language` 从 `project.yaml` 读取，缺失时可查 `.claude/docs/technical-preferences.md`。引擎名决定安全扫描 pattern。若引擎仍未确定，所有依赖代码模式的类别均为 `NOT ASSESSED`，不许退回到 Godot pattern。

`platform.online` 与 `platform.multiplayer` 控制网络攻击面是否适用；它们与 `platform.targets`（PC、console 等目标平台）不是同一信息。两个布尔值都明确为 `false` 才能据此跳过 Category 2；**缺失或空值不等于 `false`**。只要其中任一未设置，就要询问玩家是否有联机功能；无法询问时仍运行 Category 2，但报告范围未确认并标为 `NOT ASSESSED`。未知范围按多人游戏严重度评级，开放 HIGH 按 CRITICAL 处理。

代码根也必须按 `.claude/docs/code-root-resolution.md` 解析。根未解析或根下没有源文件时，适用的代码扫描类别记为 `NOT ASSESSED`，不能把没有可读代码写成零个问题。

## 六类安全检查与引擎证据

审计覆盖的类别是：

1. **存档与序列化：** 验证反序列化、路径构造、数值边界和损坏恢复。
2. **网络与多人：** 检查服务端权威、包验证、调用限速、令牌处理和调试端点。
3. **输入校验：** 查路径遍历、日志注入、越界数值和后端统计输入。
4. **数据暴露：** 查凭证、敏感日志、调试输出和内部路径信息。
5. **作弊与防篡改：** 检查关键状态、付费/排行榜等是否可信任客户端。
6. **依赖与供应链：** 盘点第三方包、版本、来源和已知 CVE。

Category 1–3 的 pattern 表必须依照项目引擎版本：Godot 列在 Skill 正文；Unity 与 Unreal 的网络、输入名称来自仓库锁定的引擎参考资料。Unity 和 Unreal 当前没有可引用的存档/序列化 API 资料，所以它们的 Category 1 是 **NOT SOURCEABLE → NOT ASSESSED**。这是资料边界，不是“没找到漏洞”。在完整审计中，只要仍有应审类别未评估，就不能把结果写成 `CLEAR TO SHIP`。版本 API 名称与参考资料不匹配也必须报告未评估；不能用旧 API 名搜不到，就宣布干净。

## 报告等级和 Gate

发现分为 CRITICAL、HIGH、MEDIUM、LOW。报告建议按先命中优先：

- 有开放 CRITICAL，或多人游戏中的开放 HIGH：**DO NOT SHIP**。
- 单人游戏有开放 HIGH、无 CRITICAL：**FIX BEFORE SHIPPING**。
- 没有更高等级阻断，但扫描面不完整：**NOT ASSESSED**。
- 只有扫描覆盖完整、没有开放 CRITICAL/HIGH：才可能 **CLEAR TO SHIP**；MEDIUM/LOW 可留在报告中。

已知的 HIGH/CRITICAL 仍优先于未评估状态：有一个未评估类别不能抹掉已经发现的严重问题。报告包含类别、文件行号、攻击场景、修复建议、工作量和依赖清单。`/security-audit` 先展示摘要，再询问是否把完整报告写入 `production/security/security-audit-[date]-[scope].md`。`workflow: standard/full` 的 Polish → Release gate 要求该报告；`minimal` 不读取它作为 Gate 项，但发现仍应修复。

Security Engineer 由 Skill 启动。Skill 要求给它准确引擎、网络范围、代码根和适用 pattern，不把调用者的“单机”“没问题”或预计严重度塞进 brief，避免扫描前预判。若 Agent 无法启动，必须如实说明是谁完成检查，并保留相同的证据边界。

## 实践：检查 unset 与显式 false

运行：

~~~sh
python3 learn_claude_code_game_studios/practice/exercise_security_scope.py
~~~

脚本把三个合成 `project.yaml` 复制到系统临时目录，再运行 CCGS 自带的 `yaml-helper.sh get_yaml_key`，读取 `engine.name`、`platform.online` 和 `platform.multiplayer`：

- Godot 配置没有 platform 标志：helper 返回空值，练习显示 `(unset)`；Category 2 不能静默跳过。
- Unity 配置两标志显式为 `false`：网络范围可以标记为不适用并说明原因；但完整 Unity 审计的存档类别仍没有源码依据，不能据此 `CLEAR TO SHIP`。
- Unreal 配置两标志为 `true`：网络类别适用；当前引擎参考没有存档 pattern，Category 1 仍为 `NOT ASSESSED`。

样例只演练配置读取和规则推导，不扫描游戏代码，不产生安全审计报告或发布签核。修改 fixture 中的 `platform` 键后重跑，观察“不知道”和“明确关闭”如何改变范围记录。

## 本课结论

安全审计先要证明扫描的引擎、代码根和攻击面，再解释命中和未评估面。缺少配置、源码、参考 API 或依赖清单时，正确做法是标出输入缺口；它们不能凭一个零命中被折算成安全结论。

## 简化说明

- 实践运行的是 CCGS 1.2.0 快照的真实 `yaml-helper.sh`，未启动 Claude Code `/security-audit` 或 security-engineer Agent。
- 实践只检查配置值并演示 Category 1/2 的范围规则，不是代码扫描器、依赖漏洞扫描器或合规评估。
- Unity/Unreal 的 NOT SOURCEABLE 结论来自本地快照的安全审计 Skill 与其引擎参考树；后续快照可能补齐来源。
- 安全扫描结论需结合确切引擎版本、实际代码根、第三方依赖及项目在线数据事实复核。

## 自测

1. `platform.multiplayer` 不存在、`platform.multiplayer: false` 分别意味着什么？
2. `platform.online: false` 但 `platform.multiplayer` 未设置时，Category 2 能否跳过？
3. 为什么 Unity/Unreal 的存档扫描不能沿用 Godot pattern？
4. 一个 Category 1 未评估、没有已知严重发现的完整审计，为什么不能写 `CLEAR TO SHIP`？
5. 报告同时有开放 HIGH 与另一个未评估类别时，建议应如何排序？
6. `workflow: minimal` 不把 Security Audit 作为 Gate 项，是否说明安全发现可以不处理？
