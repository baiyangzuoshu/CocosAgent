# 第 22 课：运营活动与内容覆盖审计

**目标：** 追踪 CCGS 如何组织赛季/限时活动策划，并用只读扫描器比较计划中的内容与项目里的文件。

完成本课后，你应该能：

1. 说出 `/team-live-ops` 从范围、叙事、经济与指标，到文案、沟通和最终审批的依赖顺序。
2. 区分团队规模、自动化模式和 review mode 各自控制什么，并识别最终产物的写入确认边界。
3. 用 `content-count.sh` 读取 registry 计划数、引擎目录的文件计数和覆盖区间。
4. 解释 `NOT ASSESSED`、近似文件计数和优先级规则的适用边界。

## 问题

一个新赛季要上线，需要同时决定做哪些内容、奖励和玩家沟通；开始制作后，又要知道 GDD 计划了多少内容、项目里已有多少。CCGS 把这些事情交给哪些流程？只读脚本算出的文件数，能不能直接证明赛季准备好了？

## 源码位置

路径相对于 `engine/Claude-Code-Game-Studios/`：

| 文件 | 本课观察点 |
| --- | --- |
| `.claude/skills/team-live-ops/SKILL.md` | `team.size`、七阶段产物依赖、决策点、伦理检查与设计文档写入协议 |
| `.claude/skills/content-audit/SKILL.md` | workflow 档位、输入缺失处理、计划清点、实现扫描、状态和报告规则 |
| `.claude/scripts/content-count.sh` | registry、引擎文件扫描、覆盖区间和 gap 表的只读 TSV 观察值 |
| `.claude/scripts/registry.sh` | entity/item registry 的统一读取，以及 deprecated 项目的处理 |
| `.claude/docs/workflow-modes.md` | `standard` 下哪些 GDD 内容属于必审范围 |
| `design/registry/entities.yaml` | 命名实体、物品和跨文档引用的登记格式 |

## `/team-live-ops`：先规划，再交付

赛季策划 Skill 按依赖组织工作，而不是把所有角色一口气并行启动：

1. **Phase 1 范围**：live-ops-designer 确定活动类型、时长、内容清单、回访机制和资源预算。
2. **Phase 2 叙事**：narrative-director 基于范围形成主题、故事钩子与现有 lore 的连接。
3. **Phase 3 经济 + Phase 4 指标**：economy-designer 设计奖励轨道、商店轮换和保底；analytics-engineer 定义成功指标、A/B 测试和埋点。这两阶段可以并行。
4. **Phase 5 文案**：只有 Phase 3 和 4 的结果都收齐，才开始玩家文案；writer 与需要的 narrative-director 可以并行。
5. **Phase 6 沟通**：community-manager 基于前面产物做预告、上线日、中期提醒和结束前沟通计划。
6. **Phase 7 审批**：汇总内容范围、经济健康、分析准备度和待决问题；没有用户批准或存在未解决伦理问题时，不给 COMPLETE。

`team.size` 决定实际活动的 Agent 集合：`individual` 默认只启动 live-ops-designer 与 economy-designer；`small` 加入 analytics-engineer 与 community-manager；`studio` 才包含完整流程中的 writer 和 narrative-director。Skill 要明确说明哪些角色本次不会启动、由谁代为咨询。`automation` 决定阶段决策是逐次询问、major-only 询问还是记录后继续；`review_mode` 在这个 pipeline 中不增加 director gate。

经济方案还要对照 `design/live-ops/ethics-policy.md`。文件缺失时必须标记伦理检查未执行；发现违反规则时，审批阻塞，需修订、记录理由覆盖或取消。最终设计文档写到 `design/live-ops/`，不属于子 Agent 可直接写入的受限目录；由协调者在取得确认后汇总写入。策划完成后可接 `/design-review`、`/sprint-plan`，内容准备部署时再进入 `/team-release`。赛季计划本身不是上线签核。

## `/content-audit`：核对计划与实现

内容审计先看输入是否存在，再算差距。缺少必需的 systems index、所有计划都未说明数量，或无法解析代码根时，相关结果是 **NOT ASSESSED — NO DATA**，而不是零差距或 COMPLETE。`workflow: full` 审所有 GDD；`standard` 只审必需章节，其他已发现内容列为本档位未审；`minimal` 因没有 systems index 而不能运行。

审计先从 `design/registry/entities.yaml` 取命名实体和物品计划清单，再读取明确写出内容数量的 GDD；找到的实现文件按引擎差异计数。`content-count.sh` 把这类工作拆成三个只读观察：

~~~sh
bash .claude/scripts/content-count.sh registry
bash .claude/scripts/content-count.sh found --engine godot --files
bash .claude/scripts/content-count.sh band 1 3
~~~

`registry` 只统计 active/未标状态的 entities 与 items，deprecated 项显示为 SKIPPED。`found` 按 Godot、Unity 或 Unreal 的约定目录和扩展名扫描；必须有可扫描根目录，空项目或未解析根不能因为计数为 0 就报通过。`band FOUND SPECIFIED` 的边界为：0 是 NOT STARTED；大于 0 且低于 50% 是 EARLY；50% 到未满 100% 是 IN PROGRESS；达到或超过计划数是 COMPLETE。`gap` 可以把系统、类型、计划数和文件数的 TSV 行汇总起来。

`content-audit` 还会结合 systems index 决定是否标记 HIGH PRIORITY。原 Skill 的条件文字对 `AND` 与 `OR` 的结合方式没有括号消歧，`content-count.sh` 也明确把优先级判断留给 Skill；不能根据 helper 的 status 单独下这个结论。

## 实践：用真实 helper 审计隔离项目

运行：

~~~sh
python3 learn_claude_code_game_studios/practice/exercise_live_ops_content.py
~~~

练习脚本会在系统临时目录创建合成 Godot 项目，复制 CCGS 的真实 `content-count.sh` 与 `registry.sh`，并创建 registry 记录及少量场景、角色、物品文件。它会展示 registry 中 active/deprecated 的数量、实际文件扫描结果、由这些观察值组成的 gap 表，以及不同覆盖率边界。另一个空项目会显示没有内容根时的 helper 错误码，供你区分“检查后为零”和“没有可扫描输入”。

预期的核心观察：3 个 active entity 只找到 1 个角色文件，属于 **EARLY**；2 个 active item 找到 1 个物品文件，正好 50%，属于 **IN PROGRESS**；4 个计划关卡找到 2 个场景，也属于 **IN PROGRESS**。registry 的 deprecated 项不计入计划数。空项目不会被解释成 COMPLETE。

脚本只写系统临时目录，不改动 CCGS 源码或真实项目。可再在隔离 CCGS 副本中运行 `/team-live-ops` 或 `/content-audit --summary`，观察真实 Claude Code 会话的 Agent 协作和交互；没有启动 Claude Code 时，不能把脚本输出描述为 Agent 运行结果。

## 本课结论

`/team-live-ops` 负责把赛季目标变成有依赖、有审批的策划产物；`/content-audit` 负责对照明确的计划数与实现文件。前者的 COMPLETE 不等于上线通过，后者的文件覆盖比例也不等于内容可玩、已发布或满足质量要求。正确结果依赖范围、输入和引擎扫描边界都被明确记录。

## 简化说明

- 练习调用的是 CCGS 1.2.0 快照的真实只读 shell helper；季节策划的 Agent、确认环节和报告由 Skill 定义，本练习没有启动 Claude Code。
- 练习的 gap 表由脚本从 registry/文件计数生成；真实 `/content-audit` 还需读取系统索引、GDD、workflow 档位和 systems priority。
- 文件计数是近似值，无法判断文件是否可用、是否属于编辑器/测试内容或是否已发布；场景扫描也可能把 UI 场景一并计入。
- HIGH PRIORITY 的布尔条件在 Skill 中没有完全消歧，课程不替它补写规则。
- 不同 CCGS 快照可能改变路径、team-size 组成或扫描规则；使用前应重新核对对应版本源码。

## 自测

1. 为什么 Phase 5 的玩家文案要等经济和分析结果都收齐后再开始？
2. `team.size: individual` 下，哪些 Agent 会实际启动？为什么需要在输出中声明被路由的角色？
3. registry 中 deprecated 的 item 为什么不进入 planned total？
4. 1/3 与 2/4 分别落在哪个覆盖状态？边界值 50% 如何处理？
5. 空项目的扫描结果为什么不是“所有内容均未开始”或“审计通过”？
6. 文件覆盖为 COMPLETE 能否证明内容达到发布质量？还缺什么证据？
