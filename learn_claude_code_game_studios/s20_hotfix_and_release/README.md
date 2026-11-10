# 第 20 课：热修复与受控发布

**目标：** 追踪 CCGS 如何在紧急修复中保留必要审核、QA 与发布确认，并辨认发布 Hook 能提醒什么、不能替用户决定什么。

完成本课后，你应该能：

1. 区分应进入 `/hotfix` 的 S1/S2 紧急问题与应回到常规流程的 S3 及以下问题。
2. 说明 hotfix 分支应从哪个已发布版本开始，以及部署前需要哪些审查和 QA 证据。
3. 运行 CCGS 的 `validate-push.sh`，分辨受保护分支提醒、发布动作确认提示和 Claude Code 的实际权限流程。
4. 追踪部署后的 backport、缺陷复验与事故复盘。

## 问题

线上版本出现崩溃或数据丢失时，团队可以绕过正常 sprint，但是否也能跳过回归测试和发布确认？如果 Hook 对 `git push main` 打印了警告，是否说明它拦住了命令？本课沿 `/hotfix` 从严重度判断到部署后验证，并在一次性 Git 仓库里运行真正的发布防护 Hook，观察不同命令会得到什么提示。

## 源码位置

路径相对于 `engine/Claude-Code-Game-Studios/`：

| 文件 | 本课观察点 |
| --- | --- |
| `.claude/skills/hotfix/SKILL.md` | 严重度路由、事故记录、hotfix 基线、实现审批、三方签核、QA re-entry、发布确认及部署后复验 |
| `.claude/settings.json` 的 `PreToolUse` | 哪些 Bash/PowerShell 命令会调用 `validate-push.sh` |
| `.claude/hooks/validate-push.sh` | 受保护分支提醒及 tag、merge、发布/部署命令的确认提示 |
| `.claude/scripts/write-guard.sh git` | Hook 识别哪些 git 与发布命令属于需要确认的动作 |
| `.claude/docs/hooks-reference.md` | Hook 的触发范围与“警告、不阻止”边界 |
| `.claude/skills/release-checklist/SKILL.md` | 发布检查如何区分失败、风险和 `NOT ASSESSED` |
| `.claude/skills/bug-report/SKILL.md` | 部署后复验与缺陷状态如何闭环 |

## 热修复保留了哪些控制点

`/hotfix` 必须由用户显式调用。它只接收 S1（崩溃、数据丢失或核心功能完全失败）和 S2（主要功能故障但游戏仍可玩）；S3 及以下转到正常缺陷流程。热修复跳过 sprint，并没有跳过证据和审批：

1. **先确认严重度并准备记录。** hotfix 记录包括问题、根因、修复、测试、审批和回滚计划；保存前先询问用户。
2. **从线上版本建立分支。** 基线是发生问题的发布 tag，或为该版本稳定而开的 `release/*` 分支；不能直接从可能含有未发布工作的 `main` 头开始。
3. **先提修复方案，再改代码。** 描述根因、最小修复和影响范围；获得实现批准后才修改。只跑受影响系统的目标测试；没有配置或覆盖测试时，明确记录未执行原因。
4. **收齐独立签核并重新过 QA。** `lead-programmer`、`qa-tester` 和 `producer` 都必须 APPROVE。之后由 `qa-lead` 决定 Smoke Check、定向 Team QA 或完整 QA。`NOT ASSESSED` 表示门禁没运行，不算通过；若最后选择带着未知结果发布，决定人和理由要写进记录。
5. **发布动作再向用户确认。** 即使 `modes.automation` 是 `autonomous`，合并、打补丁 tag 和部署前仍必须明确询问。选择只合入 `main` 时，不打 tag、不部署；选择停止时，不改缺陷状态。
6. **部署固定版本并闭环。** 部署修复所在的 patch tag，不部署 `main` 的最新头；检查修复已 backport 到 `main` 及适用的 `release/*` 分支。部署后用 `/bug-report verify` 在实际部署版本复验，无法确认时不能关闭缺陷；48 小时内安排事故复盘。

常规版本的 `/release-checklist` 是准备度评估，不是部署命令。它先检查阻断项：有失败项为 `NOT READY`；没有已知阻断但仍有未评估输入时为 `NOT ASSESSED`；只有各项都有证据才是 `READY`。缺少 bug 记录或测试结果不会自动变成通过。

这套流程把可逆步骤（创建 hotfix 分支、准备变更）与不可逆步骤（合并、标记版本、部署）分开。紧急程度可以缩小修复范围和 QA 范围，但不能把审批记录、回滚方案或部署确认变成隐式行为。

## 实践：在临时 Git 仓库里运行发布防护 Hook

`exercise_release_guard.py` 会读取真实 CCGS `settings.json`，复制真实的 `validate-push.sh` 和 `write-guard.sh` 到系统临时目录，然后把合成的 PreToolUse JSON 交给 Hook。输入里的命令只是被检查的文本；脚本不会执行 push、merge、tag 或 deploy。

从课程仓库根目录运行：

~~~sh
python3 learn_claude_code_game_studios/practice/exercise_release_guard.py
~~~

应观察到以下结果：

| 输入给 Hook 的命令文本 | 预期观察 | 说明 |
| --- | --- | --- |
| `git push origin main` | 提示目标是受保护分支 `main` | 当前临时分支是 `feature/course-demo`；Hook 根据 refspec 识别目标分支 |
| `git push origin feature/course-demo` | 没有受保护分支提示 | 普通分支不触发这条提醒 |
| `git tag --list` | 没有发布动作提示 | 这是只读查询，不是创建 tag |
| `git tag v1.2.1` | 提示创建 tag 需要先确认 | `write-guard.sh` 排除了 `git tag --list` 这类只读查询 |
| `git merge --abort` | 没有发布动作提示 | 撤销合并不等于创建合并 |
| `git merge hotfix/fix-crash` | 提示 merge 需要先确认 | `git merge --abort` 等撤销操作不属于创建合并的动作 |

六种 Hook 调用都预期退出码为 0。受保护分支的消息是提醒而不是拒绝；原有 Claude Code 用户权限询问仍然生效。临时仓库没有 remote，所有命令以 JSON 文本传入 Hook；脚本还会确认 tag 列表、HEAD 和工作区都没有变化。

### 对照人工决策与机器提示

打开 `.claude/skills/hotfix/SKILL.md`，按 Phase 1–7 在一张纸上填出以下顺序：

~~~text
严重度确认 → hotfix 记录与回滚计划 → 发布基线 → 修复方案批准 →
实现与目标测试 → lead-programmer/qa-tester/producer 签核 → qa-lead 决定 QA 范围 →
用户批准 merge/tag/deploy → backport 检查 → 部署版本复验 → 事故复盘
~~~

然后对照 Hook 的责任：Hook 识别命令并显示保护提醒；`/hotfix` 决定流程输入、组织审核并提出明确问题；用户仍控制不可逆发布步骤。单跑 Hook 不能证明完整 hotfix 流程已执行，也不代表真实 Claude Code 会话已经确认过这些状态。

## 本课结论

CCGS 的热修复流程不是“紧急所以快速直推”：它先固定正在修复的已发布版本，再做最小修复、回归检查、独立签核和按风险选择的 QA；只有用户明确确认后，才合并、打 tag 和部署。`validate-push.sh` 是提示层的一部分，不是授权系统，也不会替代 `/hotfix`、实际 QA 或部署后复验。

## 简化说明

- 实践脚本在临时目录调用本地 1.2.0 快照的真实 Hook 与 helper；它测试的是这两个脚本面对合成输入的观察结果，不是 Claude Code 的真实 PreToolUse 调度。
- Hook 对受保护分支采用退出码 0 的提示路径；不能把提示解释成阻断，也不能据此推断 git 服务器有分支保护规则。
- 本课没有执行真实修复、创建发布 tag、合并分支、上传构建或部署，也没有在目标游戏里完成 QA。
- `/hotfix` 的角色签核取决于可用 Agent 与项目流程；书面定义不等于真实签核结果。

## 自测

1. 为什么 hotfix 分支应从线上 release tag 或对应 `release/*` 分支开始？
2. `/hotfix` 中的 `NOT ASSESSED` 为什么不能当作 QA 通过？
3. `validate-push.sh` 对 `git push main` 的提醒和普通权限提示有什么区别？
4. 为什么即使选择 autonomous，合并、打 tag、部署仍需显式批准？
5. 为什么部署后仍要验证 bug，并核对修复是否 backport 到下一版会使用的分支？
