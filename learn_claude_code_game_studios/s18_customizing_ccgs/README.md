# 第 18 课：定制 CCGS

**目标：** 按需求把一个项目约定放进合适的 CCGS 层，并为改动指定可检查的证据。

完成本课后，你应该能：

1. 区分 Agent、Skill、Rule 和 Hook 的用途与触发方式。
2. 为新增 Skill/Agent 补上 studio-tests 注册项、spec 和质量类别。
3. 在隔离副本中创建一个定制 Skill 与路径 Rule，并检查它们的结构和覆盖状态。
4. 说明 /skill-test 可以评估书面定义的哪些部分，不能证明什么运行行为。

## 问题

团队希望所有对话 CSV 都遵守一套稳定键名，并且有人能快速检查重复键、空文本和缺列。应该写一个 Agent、Skill、Rule 还是 Hook？项目路径不同，Rule 该如何只在相关文件上加载？新增 Skill 怎样进入 CCGS 的自测清单？本课先做职责选择，再在一次性副本中添加一个只读 Skill、路径 Rule、数据观察 helper 和配套 spec。

## 源码位置

路径相对于 engine/Claude-Code-Game-Studios/：

| 文件 | 本课观察点 |
| --- | --- |
| README.md 的 Customization、Testing your customizations | 框架允许修改什么，以及对应自测入口 |
| .claude/skills/skill-test/SKILL.md | Skill 如何解析注册项、读取 spec 并运行 static/spec/category/audit |
| studio-tests/CLAUDE.md | catalog 的权威 spec 路径、Skill/Agent spec 的最低案例数和登记步骤 |
| studio-tests/templates/skill-test-spec.md | 新 Skill spec 需要覆盖的结构、案例和协作协议 |
| studio-tests/catalog.yaml、quality-rubric.md | 注册、类别与质量指标的对应关系 |
| .claude/rules/skill-authoring.md | 新 Skill 的 frontmatter、阶段和交接约定 |
| .claude/rules/、.claude/docs/rules-reference.md | path frontmatter 让约定在读取匹配路径时加载 |
| .claude/hooks/log-instructions.sh | 可选 InstructionsLoaded 诊断 Hook，记录实际加载的指令文件 |
| .claude/docs/hooks-reference.md | Hook 事件用途与 stdout/stderr 的边界 |
| .claude/docs/settings-local-template.md | 个人 Hook 如何通过 gitignored settings.local.json 扩展 |
| .claude/docs/CLAUDE-local-template.md | 本地偏好如何与共享的根 CLAUDE.md 分开 |

## 先选对扩展层

| 层 | 适合的问题 | 触发方式 | 常用检查 |
| --- | --- | --- | --- |
| Agent | 需要一个可委派的专长角色，拥有明确任务输入和交付物 | Skill/Agent 调度它 | agent spec、category、agent-check.sh；必要时核对委派 Skill |
| Skill | 需要可复用、可由用户调用的多步流程或命令 | 用户调用 slash command，或其他 Skill 调用 | /skill-test static、spec、category、audit |
| Rule | 某类文件每次编辑都需要上下文约束 | paths 匹配到文件时加载到上下文 | 检查 frontmatter/glob，并实际打开匹配与不匹配路径观察 |
| Hook | 某个工具或会话事件发生时必须自动执行脚本 | settings.json 或本地 settings 中的事件、matcher | 检查事件与 matcher，手动运行脚本，再在副本里触发事件验证 |

不要把这些层混为一谈：Rule 提供匹配路径的指引，不会自己运行检查；Hook 会随事件自动执行，因此错误 matcher 可能频繁触发；Skill 负责描述用户可调用的工作步骤；Agent 是可派发的角色，通常不需要独立的 slash 命令。若需求只是个人偏好，用 CLAUDE.local.md；若是个人权限或 Hook，用被 gitignore 的 settings.local.json。要让团队共享的项目 Hook 才改 settings.json，并在副本里验证其输入、输出、超时和退出码。Hook 的 stdout 是否会出现在模型上下文中取决于事件：例如 Stop 的 stdout 会进 debug log，不会像 SessionStart 那样交给 Claude；要让结果可见，须按事件合同选择写入或通知方式。

## 实践：添加一个可自测的对话 CSV 审查 Skill

练习把一个约定落实到三个层次：

1. Rule 让读取 assets/dialogue/ 下 CSV 的模型看到稳定键名与字段约定。
2. Skill 提供 /dialogue-row-audit 命令，通过独立 Python helper 报告结构事实，不修改源 CSV。
3. studio-tests spec 描述行为案例，catalog 将 Skill 登记为 utility 类别，使 /skill-test 能找到定义、spec 和 rubric。

这个例子有意将 helper 限定为**观察器**：它只报告缺失/意外列、空字段、重复 key/locale 对和数据行数，不输出 PASS/FAIL。Skill 再根据事实形成结构 verdict；若没有项目明确给出的期望语言列表，只能把语言覆盖标记为 NOT ASSESSED。Helper exit 0 只代表 CSV 可解析并完成盘点。

### 1. 创建一次性 CCGS 副本

从仓库根目录运行：

~~~sh
python3 learn_claude_code_game_studios/practice/create_sandbox.py
~~~

目标目录是 learn_claude_code_game_studios/practice/workspace/，须不存在。若已存在，换一个新的临时目录，并把它同时传给创建脚本和脚手架的 --project；不要清理或覆盖不确定归属的目录。只在这份副本内继续。

### 2. 预览并创建定制文件

默认是 dry-run，只显示计划路径：

~~~sh
python3 learn_claude_code_game_studios/practice/scaffold_custom_skill.py
~~~

检查计划后，再显式添加 --apply。脚本拒绝直接修改仓库源快照，也不会覆盖同名文件。它会在副本里创建：

- .claude/skills/dialogue-row-audit/SKILL.md 与 scripts/inspect_dialogue_csv.py
- .claude/rules/dialogue-csv.md
- studio-tests/skills/utility/dialogue-row-audit.md
- assets/dialogue/menu.csv 示例数据
- catalog.yaml 中的 Skill 注册项

检查副本内的文件列表：

~~~sh
find learn_claude_code_game_studios/practice/workspace/.claude/skills/dialogue-row-audit -type f
ls learn_claude_code_game_studios/practice/workspace/.claude/rules/dialogue-csv.md
~~~

练习副本不包含 Git 元数据；不要在副本里初始化或提交课程仓库。

### 3. 运行真实 helper 并观察事实

从副本根目录运行：

~~~sh
cd learn_claude_code_game_studios/practice/workspace
python3 .claude/skills/dialogue-row-audit/scripts/inspect_dialogue_csv.py \
  --csv assets/dialogue/menu.csv
~~~

预期 JSON 中有 2 行、没有缺失/意外列、空字段或重复 key/locale 对，并列出 en 与 zh-CN。expected_locales 会注明 not provided——helper 无法知道项目应当支持哪些语言。

复制 assets/dialogue/menu.csv 为 assets/dialogue/duplicate.csv，在副本文件中再加一行相同的 key 与 locale，重跑 helper，观察 duplicate_key_locale 中列出的行号。保留这个副本样例供下一步实际运行 Skill；原始 menu.csv 不要改。观察规则本身不会扫描或改写文件；重复项由 Skill 调用的 helper 检出。

### 4. 用 CCGS 自测系统检查新增 Skill

在副本根目录启动 Claude Code。先运行定制 Skill 本身：

~~~text
/dialogue-row-audit assets/dialogue/menu.csv
/dialogue-row-audit assets/dialogue/duplicate.csv
~~~

第一条应报告结构 PASS，同时将 locale 完整性标为 NOT ASSESSED；第二条应指出重复 key/locale 与行号并报告 FAIL。确认源文件没有被 Skill 修改。这是一次实际 Skill 调用；随后再运行 CCGS 的四种文档评估模式：

~~~text
/skill-test static dialogue-row-audit
/skill-test spec dialogue-row-audit
/skill-test category dialogue-row-audit
/skill-test audit
~~~

记录 static 的结构 verdict、spec 的案例评估、category 的 utility 指标和 audit 的注册覆盖。spec 是 Claude 对定义与书面案例的评估，不会自动运行 Python helper，也不会启动游戏。若 /skill-test 提出保存 spec 结果或更新 catalog，只在可丢弃副本中决定是否保存；studio-tests/results/ 默认不在 gitignore 中。结果文件不能与游戏 QA 报告混记。

path-scoped Rule 在 Claude Code 中只会在**读取**匹配路径的文件时加载，创建文件本身不会触发它。要验证真实加载，在副本的 .claude/settings.local.json 中合并以下本地诊断 Hook；若文件已有内容，保留原字段并把事件加入现有 hooks 对象：

~~~json
{
  "hooks": {
    "InstructionsLoaded": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "bash \"$CLAUDE_PROJECT_DIR/.claude/hooks/log-instructions.sh\""
          }
        ]
      }
    ]
  }
}
~~~

启动一个新的 Claude Code 会话，分别让它读取 assets/dialogue/menu.csv 和一个不在 assets/dialogue/ 下的文件；然后检查 production/session-logs/instructions-loaded.log。匹配的读取应有 dialogue-csv.md 的 path_glob_match 记录，未匹配路径不应因本 Rule 产生该记录。诊断 Hook 只写本地日志，不是项目必需 Hook；log-instructions.sh 说明了记录字段和读取/创建的差异。trace_rule_scope.py 只能盘点路径声明，不能代替这次运行观察。没有 Claude Code 会话时，把运行时 Rule 加载标为未验证。

rules-reference.md 记录了 Claude Code 2.1.282 上 paths 按 gitignore 风格、且忽略大小写匹配的实机观察；它也注明这不是上游文档承诺。升级或切换版本后，不要把该观察当成固定规范，用 InstructionsLoaded 日志复核当前行为。

## Agent 与 Hook 的定制边界

本次实践没有新增 Agent 或 Hook，因为目标是用户自己调用的简单审查流程。若流程需要委派给领域角色，新增 Agent 时应同步维护 studio-tests/agents/[tier]/ 下的 spec、catalog 条目和类别；spec 所在 tier 目录可以与 catalog 的 rubric category 不同。

只有在每次匹配事件都必须自动执行时才考虑 Hook。共享 Hook 进入 .claude/settings.json；本地个人 Hook 可按 settings-local-template.md 示例加入 settings.local.json，后者已被 gitignore。新增 Hook 前先把它作为普通脚本单独运行，再在隔离副本验证事件名、matcher、输入 JSON、超时、stdout/stderr 与 exit code。不要仅因“可以自动化”就把一条提示改成高频 Hook。

## 本课结论

扩展先从需求的触发者和作用范围选层：可委派的专业工作放 Agent，可重复的流程放 Skill，路径条件下的常驻要求放 Rule，事件发生时必须自动执行的动作放 Hook。一个自定义 Skill 只有定义文件还不够；catalog 和 spec 补上后，才进入 CCGS 自测的索引与覆盖范围。最后仍要区分：helper 事实、/skill-test 的书面评估、真实 Skill/Hook 会话行为是三种证据。

## 简化说明

- scaffold_custom_skill.py 只创建固定示例，默认 dry-run，不覆盖同名文件，并拒绝直接修改仓库中的 CCGS 源快照；它不是通用 Skill 生成器。
- 新 Rule 的 glob 示例只覆盖练习项目的 assets/dialogue/**/*.csv。Unity/Unreal 项目需按各自真实目录调整。
- CCGS 对 paths 的大小写与 glob 匹配记录基于 Claude Code 2.1.282 实机观察，不应外推到未观察的版本。
- 本课不自动写项目 settings.json，也不安装 Hook；Hook 需要针对实际事件和 matcher 独立验证。
- 课程中的 /skill-test 交互步骤以 CCGS 1.2.0 快照为准；其 spec/category 结果不是目标游戏的自动化测试结论。

## 自测

1. 为什么这个需求用 Skill + Rule，而不是 Agent 或 Hook？
2. Rule 的 paths 匹配成功能证明规则内容已被模型遵守吗？
3. helper 的 JSON、/skill-test spec verdict 与真实任务运行结果各证明什么？
4. 新 Skill 为什么需要 catalog 条目和至少五个行为案例的 spec？
5. 为什么未知的期望 locale 集合必须标为 NOT ASSESSED？
6. 怎样验证 Hook 是按预期事件触发，而不是只检查 JSON 写法？
