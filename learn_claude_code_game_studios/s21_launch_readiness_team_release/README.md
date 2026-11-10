# 第 21 课：上线准备与团队发布

**目标：** 从上线准备清单走到有依据的 Go/No-Go，并看清 `/team-release` 如何按发布阶段、团队规模和决策模式组织发布。

完成本课后，你应该能：

1. 按项目阶段、rigor 和认证档位裁剪上线清单，而不是给每个项目发出同一份长表。
2. 用 CCGS 的只读扫描器读取真实文件分母、代码标记和缺陷状态，并区分零命中与没有证据。
3. 按 `NOT READY`、`NOT ASSESSED`、`CONDITIONAL`、`READY` 的优先顺序解释 Go/No-Go。
4. 追踪 `/team-release` 的阶段前置条件、团队规模、质量签核、拒绝发布和部署后监控。

## 问题

候选版本已通过 Polish 阶段的 Release Gate，是否就能立刻推向玩家？还需要核对平台认证、商店、基础设施、支持团队和上线值守；其中有些项目可能没有配置相关资料，另一些可能根本没有源文件或缺陷记录。怎样避免把“没查到”误报成“通过”？本课接着第 20 课的热修复流程，观察完整版本的上线准备与跨团队 Go/No-Go。

## 源码位置

路径相对于 `engine/Claude-Code-Game-Studios/`：

| 文件 | 本课观察点 |
| --- | --- |
| `.claude/skills/launch-checklist/SKILL.md` | 清单裁剪、上线健康扫描、认证档位、`NOT ASSESSED` 处理和 Go/No-Go 优先级 |
| `.claude/skills/team-release/SKILL.md` | `project.stage` 前置条件、团队规模、七阶段发布、NO-GO 处理与部署审批 |
| `.claude/skills/gate-check/SKILL.md` | Release Gate 的 PASS/CONCERNS 如何更新 `project.stage` |
| `.claude/docs/workflow-catalog.yaml` 的 Polish 与 Release | `/release-checklist`、`/launch-checklist` 和 `/team-release` 的阶段顺序及必选/可选属性 |
| `.claude/scripts/code-markers.sh` | 带扫描文件分母的 TODO、FIXME、HACK、debug 和占位符观察值 |
| `.claude/scripts/bug-stats.sh` | 缺陷记录总数、开放状态、严重度与每条缺陷事实 |
| `.claude/skills/bug-report/SKILL.md` | 缺陷复验与状态闭环 |

## 从准备度到发布团队

课程快照的流程目录把 Polish 阶段的 `/release-checklist` 和 changelog 放在 Release Gate 前；Release 阶段再列 `/launch-checklist` 为必选、`/team-release` 为可选协调器。`/team-release` 自己还检查 `project.stage` 是否为 `Release`：未到阶段时先停止，不启动发布 Agent；`/gate-check release` 的 PASS（或用户明确接受 CONCERNS 风险）会更新 `project.yaml` 与 `production/stage.txt`。这些是工作流目录与 Skill 的合同，不能只靠清单文件名推断“已通过”。

`/launch-checklist` 先根据项目裁剪，再收集证据：

- **阶段与 rigor：** 未到达的项目阶段不应塞进清单；`minimal` 不要求项目主动放弃的流程重量。
- **认证范围：** `platform.cert_tier` 取 `none | itch | steam | console`。`none` 是明确选择，省略认证区块；未设置则要询问或标记 `NOT ASSESSED`。它与 `pc | console | mobile` 这样的设备范围不是同一个维度，不能把 `mobile` 当成认证档位。
- **扫描分母：** 每项代码和资产扫描都报告扫描了多少文件。没有解析出代码根、代码根为空或资产目录缺失时，必须写明 `NOT ASSESSED` 的原因，不能把空目录的零命中当成通过。
- **缺陷与证据：** 缺陷记录不存在时是 `NOT ASSESSED — no bug records`；存在记录但开放缺陷数为零才是已检查后无开放缺陷。测试日志或 CI 结果缺失也不能写成通过。

上线清单的结论按顺序判定：有阻断项为 **NOT READY**；没有已知阻断但仍有未评估/未确认项为 **NOT ASSESSED**；已知短板有明确 workaround 或接受的风险时为 **CONDITIONAL**；其余各项有证据才是 **READY**。因此一个已知 S1 阻断不会被一个未评估的网络检查掩盖；而“记录缺失”也不能把结果抬成 READY。

### `/team-release` 的决策结构

`/team-release` 不是把所有 Agent 一次性并行启动：

1. **Phase 0：读配置并检查阶段。** 未到 `Release` 时默认结束为 BLOCKED；若用户选择覆盖，必须说明理由，并把阶段覆盖记录到发布计划、Go/No-Go 记录和最终报告，覆盖不会改写项目阶段。
2. **Phase 1–2：定范围、做候选版本。** producer 确认里程碑与延期项；release-manager 确认候选提交、版本号和必要的稳定分支。
3. **Phase 3–4：收质量和运营签核。** QA 与 DevOps 并行执行回归、构建和 CI；网络/安全、性能、分析、翻译按项目事实决定是否参与。配置缺失不能被当成“离线”或“不适用”。
4. **Phase 5：由 producer 给出 Go/No-Go。** 若为 NO-GO，不得执行 Phase 6 的 tag、staging 或生产部署，也不启动 community-manager；覆盖 NO-GO 必须提供书面理由并写入记录。
5. **Phase 6–7：经批准后部署并监控。** 打 tag 和部署前仍要显式询问用户，即使 `automation` 是 autonomous。发布后持续看 bug、仪表盘与社区反馈 48 小时，release-manager 的报告周期到 72 小时。

`team.size` 与 `review_mode`、`workflow` 是不同配置轴：默认 `individual` 只实际启动 `release-manager`，其他角色经由核心 Agent 咨询；`small` 增加 producer、DevOps、QA lead 和 community manager；`studio` 再加入安全、分析、本地化和性能角色，多人游戏还会加入 network programmer。Skill 要先声明本次实际启动了谁、哪些角色不会启动。`collaborative`、`guided`、`autonomous` 改变阶段决策的确认/记录方式，但 Phase 6 的用户部署确认始终保留。

## 实践：运行 CCGS 的上线证据扫描器

`exercise_launch_evidence.py` 在系统临时目录创建两个合成项目，并运行 CCGS 快照自带的 `code-markers.sh` 和 `bug-stats.sh`。它只把 helper 的 TSV 观察结果打印出来，不改动模板或真实项目。

从课程仓库根目录运行：

~~~sh
python3 learn_claude_code_game_studios/practice/exercise_launch_evidence.py
~~~

第一个项目有一个 Godot `src/` 源文件、一个 TODO、一个 `print()` 调试调用、一个开放 S1 和一个已验证修复的 S2。输出应包含 `scanned_files 1`、`todo 1`、`debug 1`、`bugs 2`、`open 1`、`open_s1 1`、`closed 1`。按上线清单规则，这是 **NOT READY**：存在明确的 debug 输出和开放 S1。

第二个项目的 `src/` 目录为空，也没有 bug 记录。helper 原始计数会显示 `scanned_files 0`、`bugs 0`；课程脚本把这些事实解释为 **NOT ASSESSED**，因为没有源文件可扫，也没有缺陷记录可供核对。对照这两个项目，就能看到“搜过且无命中”和“没有可搜索的数据”不是同一种证据。

如需观察真实 Skill，可在已有的隔离 CCGS 副本中启动 Claude Code 并运行 `/launch-checklist dry-run`。dry-run 按 Skill 约定只生成清单草稿，不写 sign-off 文件。检查认证档位缺失时的提问，以及清单是否按项目阶段、rigor 和平台范围裁剪；未运行 Claude Code 时，只记录 helper 观察，不能说完成了真实上线清单。

## 本课结论

上线准备先证明检查范围和输入存在，再解释命中与缺失证据，最后由负责人作 Go/No-Go。Release Gate 负责推进项目阶段，launch checklist 负责最终准备度，`/team-release` 负责协调候选版本、签核、用户部署决定与上线监控；三者有前后关系，但不能互相替代。

## 简化说明

- 脚本用两个合成项目运行本地 1.2.0 快照的真实 `code-markers.sh` 和 `bug-stats.sh`；它不是完整 launch checklist，也不检查商店、法务、服务器、翻译或实际构建。
- `NOT READY` 与 `NOT ASSESSED` 的解释来自 `launch-checklist` 的状态规则；helper 自己输出观察值，不给发布 verdict。
- 本课没有运行真实 Claude Code `/launch-checklist` 或 `/team-release`，没有启动 Agent、tag、上传构建或部署。
- `team.size` 示例以本地 1.2.0 快照为准；不同版本请复核对应 Skill。

## 自测

1. 空的 `src/` 显示 `scanned_files 0` 时，为什么不能报“TODO 为 0，因此通过”？
2. 没有 bug 记录与有记录但全部 `Verified Fixed` 有何区别？
3. `platform.cert_tier: none` 与未设置的结果为什么不同？
4. `/team-release` 在 `project.stage: Polish` 时为什么不会直接启动 release-manager？
5. producer 给出 NO-GO 后，哪些发布动作必须停下？
6. 为什么 autonomous 模式不能自动替用户批准生产部署？
