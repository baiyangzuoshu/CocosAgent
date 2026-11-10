# 第 19 课：升级与兼容

**目标：** 根据项目的真实版本和 Git 历史选择升级路径，并在动手前分清框架文件、项目配置和需要迁移的自定义内容。

完成本课后，你应该能：

1. 用 Git 标签、`project.yaml` 和 `CHANGELOG.md` 交叉判断本地框架版本，并说明每种证据的限制。
2. 根据是否有共同 Git 历史选择合并、选择性检出、挑选提交或手动复制。
3. 用三方文件盘点找出模板更新、项目定制、冲突和删除，再回到版本专属升级清单决定怎么处理。
4. 为旧项目列出迁移、升级后检查和仍未验证的事项。

## 问题

CCGS 更新后，哪些文件可以直接接收，哪些文件承载游戏项目数据，哪些旧文件需要先迁移内容再删除？单看 `project.yaml` 的 `framework.version` 是否足够？本课先用实际升级指南回答，再运行一个只读脚本，练习比较旧模板、当前游戏项目和新模板三棵目录树。

## 源码位置

路径相对于 `engine/Claude-Code-Game-Studios/`：

| 文件 | 本课观察点 |
| --- | --- |
| `UPGRADING.md` 的开头与 Upgrade Strategies | 版本识别、共享历史时合并、无共同历史时选择性检出、挑选提交和手工复制 |
| `UPGRADING.md` 的 `v1.1.3 → v1.2.0` | 版本专属变更，以及 Safe to Overwrite、Merge Carefully、Delete 清单 |
| `UPGRADING.md` 的 `v1.0 → v1.1`、`.claude/scripts/migrate-v1-config.sh` | `project.yaml` 首次出现时如何迁移旧配置；为何不能把项目配置当模板文件覆盖 |
| `CHANGELOG.md` 的 `[1.2.0]` | 发布范围和与升级指南对应的变更摘要 |
| `project.yaml` | 框架版本戳，以及配置文件中仍有项目专属设置 |
| `.claude/settings.json`、`.worktreeinclude`、`.gitignore` | 1.2.0 的 Hook、worktree 与权限合并事项 |
| `studio-tests/`、`docs/engine-reference/` | 重命名目录迁移，以及项目仍固定在旧引擎版本时的兼容选择 |

## 先确认版本和升级路径

升级指南给出的版本线索按适用情况使用：

1. 如果项目是克隆或合并模板得到、并共享 Git 历史，`git describe --tags --abbrev=0` 会给出项目历史中的最新发布标签。
2. 否则查看 `project.yaml` 的 `framework.version`。它记录文件最后一次被标记的版本，保留自己的配置文件后可能落后；1.1 以前的项目没有该文件。
3. 如果项目仍保留模板的 `CHANGELOG.md`，其首个版本标题可辅助判断模板快照版本。

这些线索不等价：`framework.version` 不是完整文件清单，也不能证明所有文件都来自该版本。若来源不清，先比较目录和 Git 历史，标记不确定项；不要只凭版本戳覆盖项目文件。

然后确认历史关系和目标：

| 条件 | 升级方式 | 关键边界 |
| --- | --- | --- |
| 项目与模板有共同 Git 历史 | Strategy A：加模板 remote、fetch 后 merge | Git 主要让双方都改过的文件进入冲突处理；仍需审阅普通合并结果 |
| 没有共同历史，但项目有 Git | Strategy A2：对框架路径做选择性 checkout，再逐项恢复定制 | checkout 会暂存且覆盖同名框架文件；先检查差异，不要使用 `--allow-unrelated-histories` |
| 只需要一项功能 | Strategy B：挑选特定提交 | 核对提交依赖，不要把单个提交当成完整版本升级 |
| 项目来自 ZIP 或没有可用 Git 历史 | Strategy C：按版本清单手工复制和合并 | 只覆盖明确列为安全的文件；逐项合并用户数据 |

## 实践：盘点三方目录的升级差异

`compare_ccgs_upgrade.py` 是只读目录观察器：它对比共同基线、待升级项目和目标模板中的相对路径、文件内容摘要、可执行位与符号链接，并按差异类型分组。它不执行 checkout、复制、删除、合并或安全判定。

### 1. 跑内置示例

从课程仓库根目录运行：

~~~sh
python3 learn_claude_code_game_studios/practice/compare_ccgs_upgrade.py --demo
~~~

示例会在系统临时目录写入三份**合成数据**，完成后自动清理。输出中应看到：

- `CLAUDE.md` 与定制 Agent 属于 `both_changed_differently`：项目和框架都改过，需要对照三方版本手工合并。
- `project.yaml` 属于 `local_only`：项目配置变化没有出现在上游模板中，应保留并审查。
- `.claude/settings.json` 属于 `upstream_only`：只有目标模板改变；仍需查看对应版本的合并清单，不能仅凭这个分类直接覆盖。
- 示例中的新增、删除和共同改动会分别出现在 `upstream_added`、`local_added`、`upstream_only` 或 `both_changed_same` 中。

输出只列摘要而不显示完整差异；要决定内容怎么合并，仍要打开对应文件并阅读版本专属升级说明。

### 2. 准备真实三方目录（可选）

为自己的项目准备三个完整目录：

- `base`：项目最初采用的 CCGS 模板版本，也就是共同基线。
- `local`：尚未升级的游戏项目当前目录。
- `upstream`：准备升级到的 CCGS 版本。

如果本地 Git 历史中有对应模板标签，可把模板版本导出为独立目录；下面仅为示意，标签名按项目实际情况替换：

~~~sh
mkdir -p /tmp/ccgs-base /tmp/ccgs-upstream
git archive <base-tag> | tar -x -C /tmp/ccgs-base
git archive <target-tag> | tar -x -C /tmp/ccgs-upstream
~~~

把 `local` 指向升级前项目的副本或目录，然后运行：

~~~sh
python3 learn_claude_code_game_studios/practice/compare_ccgs_upgrade.py \
  --base /tmp/ccgs-base \
  --local /path/to/game-project \
  --upstream /tmp/ccgs-upstream \
  --limit 30
~~~

如果没有 Git 标签，可以从可信备份准备三份目录。不要把 `base` 指成目标版本，也不要在唯一的工作副本上试升级。脚本要求每棵树根目录有 `CLAUDE.md`；它跳过 `.git`、常见引擎缓存/构建目录和 `.DS_Store`，不验证目录版本身份，也不计算语义差异。

把报告这样读：

| 分类 | 盘点含义 | 接下来怎么做 |
| --- | --- | --- |
| `unchanged` | 两边都与基线一致 | 通常无需处理；按升级说明检查配套依赖 |
| `upstream_only` / `upstream_added` | 目标模板改了或新增 | 对照这个版本的 Safe to Overwrite / Merge Carefully / Delete 清单 |
| `local_only` / `local_added` | 项目相对基线有本地改动或新增 | 保留项目意图，检查有没有依赖已删除框架文件 |
| `both_changed_same` / `both_added_same` | 双方内容相同 | 内容无需合并，但仍要检查路径重命名和依赖变化 |
| `both_changed_differently` / `both_added_differently` | 双方改动不同 | 逐项比较三份文件，手工合并并审查行为 |

如果分类是 `local_only` 但 local 显示 `deleted/absent`，它代表项目曾删除基线文件：先判断这是有意删除还是意外缺失。盘点无法识别文件“归属”；归属由版本说明和项目实际用法决定。

### 3. 对照真实版本清单：1.1.3 → 1.2.0

本地课程快照的 `project.yaml` 标记 CCGS 1.2.0，`CHANGELOG.md` 将 1.2.0 标为 2026-10-19 发布。本例只用于解释这份快照中的升级指南，不表示上游之后没有新版本。

阅读 `UPGRADING.md` 的对应版本段落并把盘点结果映射到具体动作：

- **可整体接收的框架文件：** `.claude/hooks/*.sh` 与配套 `.claude/scripts/**` 必须作为一组更新；新 Hook 会调用新脚本。未定制的 Agents/Skills、除 `technical-preferences.md` 之外的文档、新的 `scene-files.md` Rule 等按清单处理。对已定制 Agent/Skill，要把改动重新合到新版文件里。
- **必须仔细合并的项目文件：** `.claude/settings.json` 要合并新 Hook、权限与 worktree 设置，同时删除已移除的 `PostCompact` 注册，避免重复注册或指向不存在的脚本。若 `.claude/settings.local.json` 中有旧的 `Bash(git *)` 宽权限，也按指南缩小到实际需要的命令。`.gitignore`、`.worktreeinclude`、`.gitattributes`、`CLAUDE.md` 也按指南补充或合并。
- **保留项目配置：** `project.yaml` 里的游戏配置属于用户数据。1.2.0 的 `framework.version: 1.2.0` 只是可选版本戳，该版本没有代码读取它；不要为更新版本戳而覆盖其他配置。`.claude/docs/technical-preferences.md`、项目自己的 `README.md`、游戏 Registry 也要保留相应项目内容。
- **迁移后再删除：** 旧的 `CCGS Skill Testing Framework/` 改名为 `studio-tests/`。先搬移自写 spec，并将 `catalog.yaml` 中对应 `spec:` 路径改到新目录，再删除旧目录。删除 `post-compact.sh` 时也要删除 `settings.json` 中对应 Hook 注册。
- **保留引擎版本兼容：** 如果项目仍使用 Godot 4.6 或 Unreal 5.7，保留相应旧版 `docs/engine-reference/<engine>/`，不要用 Godot 4.7 或 Unreal 5.8 的 API 说明替换；升级 CCGS 模板本身不会升级游戏引擎。

先在副本内应用变更，再运行 `/settings` 查看有效配置；需要时运行 `/setup-engine` 刷新 CCGS 记录的引擎安装信息，检查 Hook/脚本路径、Registry 和自定义 Skill，并根据项目实际要求运行对应游戏检查。记录哪些步骤已执行、哪些依赖 Claude Code 会话或目标引擎而暂未验证。静态盘点和文档阅读都不能证明新 Skill、Hook 或游戏运行时已经兼容。

## 本课结论

升级是一次有基线、有目标版本、有项目定制的三方迁移。先用可信证据确认版本和 Git 历史，再用版本专属清单决定接收、合并、迁移或保留。自动分类能缩小人工检查范围，但不能替代文件所有权判断、运行验证和升级后的项目测试。

## 简化说明

- 内置 `--demo` 用合成文件展示分类规则，不代表任何真实 CCGS 版本兼容性。
- 对比脚本仅观察路径、内容摘要、可执行位和符号链接；不读 Git 历史、不比较文本行、不写入目录，也不判断一个路径是否可以覆盖。
- 本课的具体变更示例针对随课程仓库提供的 1.2.0 快照及其 `UPGRADING.md`；不同起止版本必须阅读对应版本段落。
- 课程没有在真实项目中应用升级，也没有启动 Claude Code、Godot、Unity 或 Unreal 做运行验收。

## 自测

1. 为什么保留 `project.yaml` 后，`framework.version` 可能不能准确反映每个框架文件的版本？
2. 有共同历史和没有共同历史的项目，为什么应选择不同 Git 升级方式？
3. `upstream_only` 为什么不等于“安全覆盖”？
4. 删除旧 `CCGS Skill Testing Framework/` 前，必须迁移哪些项目内容？
5. 项目仍固定在 Godot 4.6 时，为什么不应直接接收 4.7 的引擎参考目录？
6. 三方盘点、Claude Code 会话检查和游戏运行验收各自能证明什么？
