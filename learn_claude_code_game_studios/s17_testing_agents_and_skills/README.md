# 第 17 课：测试 Agent 与 Skill

**目标：** 看懂 CCGS 如何检查它自己的 Skill 与 Agent，并划清框架自测和游戏 QA 的界线。

完成本课后，你应该能：

1. 说明 studio-tests 测的是 CCGS 框架定义，不是正在开发的游戏。
2. 按问题选择 static、spec、category 或 audit，并解释每种模式读取什么。
3. 从 catalog 找到目标定义、测试 spec、质量类别和历史记录。
4. 说明 helper 的观察、/skill-test 的文档评估和真实任务运行各自能证明什么。

## 问题

一个 Skill 的静态结构符合规范，是否代表它在游戏项目里会正确工作？一份行为 spec 有很多测试用例，是否代表 CCGS 已实际调用这些用例？qa-tester Agent 和 studio-tests/agents/qa/qa-tester.md 分别是什么？本课沿 CCGS 自测入口追踪这些问题，避免把框架质量检查误写成游戏测试结果。

## 源码位置

路径相对于 engine/Claude-Code-Game-Studios/：

| 文件 | 本课观察点 |
| --- | --- |
| studio-tests/README.md | 自测框架的用途、依赖关系、四种模式及其边界 |
| studio-tests/catalog.yaml | Skill/Agent 注册、spec 路径、category、priority 和最近检查记录 |
| studio-tests/CLAUDE.md | 新增/维护测试 spec 的要求与流程；spec 路径以 catalog 为准 |
| studio-tests/quality-rubric.md | 不同 Skill 类别和 Agent 类别的书面质量指标 |
| .claude/skills/skill-test/SKILL.md | /skill-test 如何选择目标、加载文件并解释各模式 |
| .claude/skills/skill-improve/SKILL.md | 与 /skill-test 分开的“测试—修改—复测”改进循环 |
| .claude/scripts/skill-lint.sh | 机械提取 Skill 结构事实；只输出观察值 |
| .claude/scripts/agent-check.sh、compat-inventory.sh | Agent 定义、委派关系和兼容性观察；不替代 rubric 判断 |
| studio-tests/skills/、studio-tests/agents/ | 按定义类型和类别组织的 spec 与行为案例 |

## 先划清被测对象

studio-tests 是**开发 CCGS 框架时使用的测试设施**：它评估 .claude/skills/ 下的 Skill 定义、.claude/agents/ 下的 Agent 定义以及相关委派信息。它不是 Godot、Unity 或 Unreal 游戏的测试运行器。游戏中的测试计划、自动化测试、Smoke Check、试玩和运行证据仍由项目自己的 QA 流程负责，例如第 16 课追踪的 /smoke-check 和 /test-evidence-review。

一个 Agent 也可能同时出现在两种角色里：qa-tester 是被游戏工作流委派去执行 QA 任务的角色；它在 studio-tests/agents/qa/qa-tester.md 对应的 spec 则是“如何评估这个 Agent 的书面定义”。studio-tests/agents/qa/ 用于组织 Agent 测试 spec；例如 security-engineer 的 spec 在 qa/ 下，但 catalog 把它归为 specialist。这个测试目录层级不等于 Agent 定义的实际文件路径，也不等于 rubric category；检查类别应读 catalog。

## 四种 /skill-test 模式

| 模式 | 读取与检查 | 不能据此声称 |
| --- | --- | --- |
| static | Skill：7 项结构检查；Agent：Agent 元数据、委派和兼容性观察 | 结构检查通过代表 Skill/Agent 已在真实任务中正确执行 |
| spec | 逐项对照目标定义、spec 中的 fixtures、预期行为和断言；由 Claude 评估书面指令是否覆盖案例 | fixture 已被自动运行，或目标 Skill 已经执行过 |
| category | 按 catalog 的类别套用 quality-rubric 中的专项指标 | rubric 书面要求通过代表玩家可见行为正确 |
| audit | 汇总定义、spec 覆盖和 catalog 中的最近检查记录 | 有记录就代表最近一次结果成功；无记录就代表功能失败 |

四种模式都会**读文件**，不会运行被测的 Skill。spec 是对指令文本和预设情境的推理评估，不是自动化游戏测试或行为回放。category 中的 PASS/FAIL/WARN 也是对书面定义按指标打分。static 背后的 skill-lint.sh 只提取 frontmatter、标题、关键词等事实；它的 exit 0 表示 helper 完成，不等于 /skill-test verdict。Agent 没有 Skill 的七项结构 verdict，static 对 Agent 只做对应观察。

/skill-improve 不是第五种测试模式；它是单独的改进 Skill，可在确认后修改定义，再重新检查。修改文档的 rubric 分数只能说明书面指令变化，不能替代把 Skill/Agent 放到真实游戏任务中观察。

## catalog 与 spec 如何配合

catalog 是注册和追踪表：每个条目指向 .claude/skills/ 或 .claude/agents/ 中的定义，也指向 studio-tests/ 下的 spec，并记录 category、priority 与检查历史。先读条目的 spec:，不要根据 Agent tier 或 Skill 目录推断测试文档位置。spec 会给出 fixtures、预期行为和 assertions；框架维护约定还要求至少五个案例，并覆盖协议要求。

quality-rubric 为不同类别写了不同指标，例如 gate-check 属于 gate 类别，对应 G1–G5；utility 类别则使用通用的静态指标，若适用再检查 gate mode。类别是工作职责的分类，不是档案目录或执行模型层级。catalog 中空白的 last_* 表示该条目没有登记对应历史结果；它不说明检查通过或失败。

## 实践一：盘点 catalog 并调用只读 helper

从仓库根目录运行：

~~~sh
python3 learn_claude_code_game_studios/practice/inspect_studio_tests.py
~~~

默认检查 gate-check Skill。脚本使用 Python 标准库读取 catalog、核对注册项与本地定义/spec 的数量、统计案例和指标，再调用 skill-lint.sh 打印结构观察值。它不写文件、不启动 Claude Code，也不执行 gate-check。

换一个 Skill 或 Agent：

~~~sh
python3 learn_claude_code_game_studios/practice/inspect_studio_tests.py --kind skill --name qa-tester
python3 learn_claude_code_game_studios/practice/inspect_studio_tests.py --kind agent --name qa-tester
~~~

第一条应提示 catalog 中找不到名为 qa-tester 的 Skill（Agent 与 Skill 是不同注册表）；第二条读取 Agent 条目、关联 spec 和 agent-check.sh 的输出。再选 security-engineer，对照定义路径、spec 路径与 category：它的 spec 位于 studio-tests/agents/qa/，catalog 类别却是 specialist。

观察输出时记录：

1. catalog 与 live definition 数量是否对齐；spec 缺失项数量是多少？
2. 目标 spec 有多少 Case 和 checkbox assertions？它们是否被脚本“执行”了？
3. helper 输出哪些观察行？是否出现 PASS/FAIL verdict？helper exit code 代表什么？
4. target 的 category 与 rubric metric ID 是什么？catalog history 空白应如何解释？

当前 CCGS 1.2.0 快照中有 74 个 Skill 和 49 个 Agent，引用的 spec 齐全；gate-check 在 gate 类别，spec 含 10 个行为案例。统计数字是快照观察结果，不是测试通过率；若你的源码版本不同，应以本次脚本输出为准。

## 实践二：在隔离副本观察四种真实模式

先按实践环境说明创建一次性的 CCGS 副本，在该副本内启动 Claude Code。不要直接在原始源码目录执行可能更新结果或 catalog 的操作。依次尝试：

~~~text
/skill-test static gate-check
/skill-test spec gate-check
/skill-test category gate-check
/skill-test audit
~~~

每次记录它读取的文件、输出的观察/判定、token 成本和是否提出写入 studio-tests/results/ 或 catalog。studio-tests/results/ 不在 gitignore 中。若要保存结果，只在可丢弃的副本中按会话确认；检查完比较 git status 和文件变化，避免把结果文件误提交，再清理副本。spec 和 category 评的是写好的指令；不要把输出登记为游戏运行记录。

要观察真实行为，再在**隔离的游戏项目**中触发一个具体 Skill 或委派一个 Agent，给定可复现的任务输入，检查它做出的决策、文件改动与验收证据。将此结果与对应 spec 案例逐项对照。没有实际触发的步骤记为“未观察”，不要用静态 helper 输出补成运行结论。

## 本课结论

CCGS 同时包含框架自测和面向游戏项目的 QA 工作流，它们回答不同问题。/skill-test 以定义、spec、category rubric 和覆盖历史评估框架组件的书面质量；helper 帮忙提取可核验事实；真实任务运行才提供 Agent/Skill 实际行为证据。要报告一个结论，至少要写清被测对象、模式、输入/spec、评估结果和证据边界。

## 简化说明

- inspect_studio_tests.py 只解析 catalog 并调用 skill-lint.sh 或 agent-check.sh。它不复刻完整 YAML 解析器，不评估 spec/rubric，也不生成 verdict。
- /skill-test spec 是 Claude 对书面案例的推理评估，不是游戏 runner；fixture 和断言不会因此自动执行。
- /skill-test 的真实结论取决于 CCGS 版本、目标定义与当前 rubric；本课路径对照本地 1.2.0 快照，升级后需重查。

## 自测

1. /skill-test static gate-check 与真正运行 /gate-check 分别观察什么？
2. 为什么一份 spec 写有 fixture、assertion，并不表示它们被自动运行？
3. catalog 的 spec:、category: 和 last_spec: 分别表示什么？
4. 为什么 qa/ 目录不能总被当作 rubric qa 类别？
5. helper exit 0、spec 评估通过、游戏 QA 通过三者各自代表什么？
