# 第 16 课：运行观察与 QA 证据

**目标：** 把代码检查、自动化测试、构建、实际运行、截图和试玩证据分开，判断每种证据到底能支持什么结论。

完成本课后，你应该能：

1. 区分 parse、test、build、launch、screenshot 和 playtest 的证明范围。
2. 按 Story Type 找到 CCGS 要求的证据，并说明 qa.level: minimal 会放宽什么、不会放宽什么。
3. 记录可追溯的运行结果、截图路径、测试条件和代码版本。
4. 识别“未运行”“没有测试”“没有 Story”和“已运行但失败”之间的差异。

## 问题

一次代码 parse 成功，是否代表游戏可以启动？自动化测试全过，是否能证明 UI 没有裁切？报告里列了截图文件名，是否等于截图已经留存并被检查？CCGS 把每种证据限定在不同范围内；本课沿证据链查看它们如何支撑 Story 关闭与 Smoke Check。

## 源码位置

路径均相对于 engine/Claude-Code-Game-Studios/：

| 文件 | 本课观察点 |
| --- | --- |
| .claude/docs/run-and-observe.md | player-visible Story 的启动、捕获、查看、留存和 Run result 规范 |
| .claude/docs/coding-standards.md | Story Type 对应的最低测试证据与默认阻塞级别；minimal 的截图规则 |
| .claude/docs/templates/test-evidence.md | AC 对照、构建版本、测试条件、截图路径和签核字段 |
| .claude/scripts/test-run.sh | 测试命令、预检查、运行行、零测试提示与 rule 观察；脚本本身不产出 verdict |
| .claude/skills/smoke-check/SKILL.md、references/2-run-tests.md | 执行自动化测试、解释退出码和形成 Smoke Check verdict |
| .claude/skills/dev-story/SKILL.md | parse 与实际运行观察的不同步骤，以及 OBSERVED / NOT VERIFIED / N/A |
| .claude/skills/story-done/SKILL.md | 如何按 AC 核对测试、截图、试玩结果及证据新鲜度 |
| .claude/skills/test-evidence-review/SKILL.md | 证据质量、缺项、签核、零 Story 范围与 NOT ASSESSED |

## 证据类型与边界

| 证据 | 能说明 | 不能单独说明 |
| --- | --- | --- |
| Parse / 静态检查 | 文件语法或特定结构可被检查器接受 | 游戏能构建、能启动或行为正确 |
| 自动化测试 | 被测试代码路径在测试输入和断言下的结果 | 未覆盖逻辑正确、UI 布局正确或“手感”良好 |
| Build | 当前配置能产出构建结果 | 构建能启动、核心流程可玩、视觉内容正确 |
| Launch / runtime check | 指定构建在指定环境中启动并执行了观察步骤 | 未到达的场景、未观察的 AC 或不同硬件上的表现 |
| Retained screenshot | 某次运行中特定时刻出现的屏幕、布局、颜色、内容与可读性 | 动画时序、响应感、音画同步或持续运行稳定性 |
| Playtest / video | 试玩流程中的体验、时序和玩家反馈 | 未测试平台、未覆盖路径或所有玩家体验 |
| stamp.txt receipt | 截图所依据的代码文件此后是否变化 | 截图是否真实、清楚或满足 AC |

### 自动化测试不是截图，截图也不是测试报告

test-run.sh 可按 Godot、Unity、Unreal 选择项目测试命令，输出 ran、退出码、测试数量、错误摘要、运行规则行等观察值。它的退出码 0 表示 helper 成功执行并报告结果，不保证测试 PASS；例如 0 条测试、没有 runner、或预检查未通过都会有各自的观察行。/smoke-check 再结合 engine-specific 退出码规则、覆盖检查和手动关键路径，形成自己的 verdict。

同理，/story-done 会核对测试文件或证据是否存在、AC 是否被覆盖，但它不替你运行测试。/test-evidence-review 审查测试和人工证据的质量，也不是运行器。一个 Story 的文件状态、脚本 exit 0、Smoke Check PASS 和视觉已被人看过，是不同事实。

### player-visible Story 必须实际运行并保留观察

run-and-observe.md 要求任何改变玩家可见内容的 Story 在关闭前启动并观察，至少保留一张图片到 production/qa/evidence/[story-slug]/。默认窗口目标是 1280×720，启动到被修改的场景，等待真实帧、捕获、退出，然后打开图片对照 AC。不能用 headless / batch / null-RHI 来代替视觉观察。不同引擎的启动和捕获机制不同，照该文档的 Godot 4、Unity 6 或 Unreal 5 小节操作。

完成实现的摘要必须有一行：

- Run result: OBSERVED — ...：确实运行、截图留存并打开检查，说明看到了什么和图片路径。
- Run result: NOT VERIFIED — ...：环境、运行、捕获或查看步骤没完成；视觉/UI Story 默认不能据此关闭。
- Run result: N/A — ...：只用于确实没有任何可观察行为的 Story，并解释原因。不能以“Logic 类型”为由跳过，因为逻辑结果也可能显示给玩家。

静帧适合查布局、裁切、溢出、可见元素、颜色和可读性；时序、动感、音频同步和手感需要视频或真人试玩，静帧不能证明它们。Visual/Feel Story 还需要留存证据文档中的 Lead sign-off；UI Story 通常以触及的每个屏幕截图闭环，无需签核文档。

## 一份可追溯证据记录

.claude/docs/templates/test-evidence.md 不只放一个图片链接。它把这些信息绑在一起：

1. Story 路径、Story Type、日期、Tester 与 Build / Commit。
2. 覆盖的 Acceptance Criteria 编号与逐项 PASS / FAIL 结果。
3. 图片或视频的实际文件名、可见内容和对应 AC。
4. 初始游戏状态、平台/硬件、帧率与特殊设置。
5. 观察备注与所需角色签核。

截图必须真的在磁盘上，并且 review / close 流程要打开看过。代码改动后旧截图可能不再描述当前实现；review-receipts.sh hash <changed files> 保存文件哈希，之后用 review-receipts.sh check .../stamp.txt 查 CHANGED / GONE。receipt 只帮助发现证据可能过期，不代替重跑和重拍。

### 不同 Story Type 的证据基线

- **Logic**：单元测试；qa.level: minimal 时自动测试可豁免，但存在的测试仍可被审查。
- **Integration**：集成测试或记录了该 Story 的试玩；minimal 可豁免测试证据。
- **Visual/Feel**：留存截图和 lead sign-off；若测试标准里要求表现观察，不能只贴测试文件。
- **UI**：每个改动屏幕留存截图；不要求单独的证据文档或 sign-off。
- **Config/Data**：Smoke Check 报告；配置/数据 Story 的证据可能随 qa.level 和 strictness 降为豁免或 advisory。

**minimal 只放宽部分自动化测试要求，不豁免视觉与 UI 的截图。** 同时，/test-evidence-review 对空 Story 范围报告 NOT ASSESSED；0 个 Story、0 个缺项不能推成证据全过。

## 实践一：预览 CCGS 测试计划并盘点证据

从仓库根目录运行：

~~~sh
python3 learn_claude_code_game_studios/practice/trace_qa_evidence.py \
  --project engine/Claude-Code-Game-Studios \
  --engine godot
~~~

脚本用 test-run.sh --dry-run 只解析将执行的测试计划，不运行游戏、不运行测试；然后列出 Story、图片、视频、证据文档、receipt、smoke 和 playtest 文件数量。当前 CCGS 快照不是游戏项目，因此预期看到没有 Godot/gdUnit4 测试可运行、Story 和 QA 证据数量为零。helper exit: 0 只代表 dry-run 报告成功，不能记成测试通过。

若要盘点隔离的游戏副本，指定真实项目路径和引擎：

~~~sh
python3 learn_claude_code_game_studios/practice/trace_qa_evidence.py \
  --project learn_claude_code_game_studios/practice/workspace \
  --engine godot
~~~

挑一个 in-scope Story，把它的 Type 和 AC 与清单中对应证据逐项对照。只有文件名、没有截图本体；只有图片、没有对应 AC；或只有测试计划、没有运行结果，都不能说该 AC 已通过。

## 实践二：在隔离游戏项目完成一次运行观察

此练习需要一个已配置 Godot / Unity / Unreal 的**游戏项目**。课程附带的 CCGS 框架快照没有游戏场景、Story 或配置好的测试 runner；不要把它当作被运行的游戏。

1. 在 CCGS 隔离副本里选择一个已有 player-visible Story，确认 Story 的 AC、修改场景和引擎版本。先有相应 QA 计划，再开始执行。
2. 按 project.yaml 的 commands.run / engine.path 和 .claude/docs/run-and-observe.md 解析实际运行命令，确保不是 headless/batch 渲染模式，并直接到达 Story 修改的场景。
3. 启动并让真实画面运行；按引擎说明捕获窗口/帧，保存到 production/qa/evidence/[story-slug]/。打开图片，逐项比对 AC；需要验证动作/时序时，录视频或安排试玩。
4. 填写 test-evidence.md：记录 Build/Commit、设备、起始状态、AC 与截图路径；Visual/Feel 取得 Lead sign-off。
5. 运行 review-receipts.sh hash 为改动文件生成 stamp.txt，之后用 review-receipts.sh check 观察代码是否晚于证据。
6. 对自动化部分在隔离项目运行 /smoke-check，查看实际测试是否运行、是否命中零测试保护、build 与 critical-path 的结果。将 Smoke Check verdict 和 Run result 分别记录。
7. 若没有引擎或运行环境，记录 NOT VERIFIED — [具体原因] 并停止作出“画面正确”的结论；不要拿 dry-run、静态分析或截图模板填补运行证据。

## 本课结论

自动化测试回答断言覆盖范围内的行为，build / launch 回答当前配置是否产出并启动，截图回答某一运行状态下画面如何，试玩回答玩家在流程中的体验。证据要关联 AC、Story、构建版本和运行条件；文件存在与检查通过都要有单独证据。CCGS 把测试运行交给 /smoke-check，视觉观察过程交给 /dev-story 与 run-and-observe，关闭时再由 /story-done 核对。

## 简化说明

- trace_qa_evidence.py 只 dry-run test-run.sh 并盘点文件，不启动引擎、不执行测试、不判断证据质量，也不形成 verdict。
- CCGS 模板仓库不包含正在开发的游戏，所以它的空 Story/QA 文件夹不能代表任何游戏 Story 的证据失败。
- test-run.sh、/smoke-check 和 /test-evidence-review 依据 CCGS 1.2.0 与其 engine/version 文档；目标引擎版本和平台需要在实际项目中核对。

## 自测

1. Parse 成功、测试全过、build 成功，分别还没有证明什么？
2. test-run.sh 的 exit 0 为什么不等于测试通过？由谁把观察映射为 verdict？
3. 为什么在 qa.level: minimal 下，UI Story 仍需截图？
4. 一张截图能不能证明动画手感、响应速度或音画同步？还需要什么观察？
5. receipt 的 CHANGED 告诉你什么？为什么它本身不会判断 screenshot 是否正确？
6. Story 没有运行环境时，应如何记录？零条 Story 的空证据目录能得出什么结论？
