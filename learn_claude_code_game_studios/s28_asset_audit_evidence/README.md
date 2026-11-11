# 第 28 课：资产审计与证据边界

**目标：** 用 CCGS 的资产扫描脚本收集文件层面的证据，并依照 `/asset-audit` 规则区分发现、未评估项和最终结论。

完成本课后，你应该能：

1. 区分 `/asset-audit` 的文件扫描与 `/content-audit` 的 GDD 计划覆盖检查。
2. 读懂 `asset-scan.sh` 的命名、尺寸、引用、缺失和排除记录。
3. 解释 `hits`、退出码 0 和 Skill 最终 verdict 各自能证明什么。
4. 在扫描范围不完整时保留 `NOT ASSESSED`，不把零文件误写成合规。

## 问题

项目里有三张 PNG，扫描器列出零个缺失引用，这能证明资产都可用、命名都符合项目标准吗？扫描数量、某类命中和审计 verdict 是不同层次的结果；还要看哪些检查实际运行，以及谁负责汇总结论。

## 源码位置

路径相对于 `engine/Claude-Code-Game-Studios/`：

| 文件 | 本课观察点 |
| --- | --- |
| `.claude/skills/asset-audit/SKILL.md` | 输入条件、Godot/Unity/Unreal 范围、判定优先级和不评估规则 |
| `.claude/scripts/asset-scan.sh` | 资产文件观测、检查状态、命中行和退出码 |
| `.claude/scripts/yaml-get.awk` | 从 `project.yaml` 解析引擎名 |
| `.claude/skills/content-audit/SKILL.md` | 对比资产级扫描与 GDD 内容覆盖审计的边界 |
| `studio-tests/skills/analysis/asset-audit.md` | 合规、缺少预算、无资产和无代码等测试规格 |

## 两种审计回答不同问题

`/asset-audit` 观察真实落盘资产：名称、文件大小、PNG 尺寸、部分音频采样率，以及 Godot 代码中的资源路径是否指向存在或未引用文件。`/content-audit` 则对照 GDD、registry 和实现目录中的计划数量。资产文件存在，不等于它满足设计清单；文件数量接近计划，也不等于它能被代码加载。

引擎不同，证据范围也不同：Godot 扫描 `assets/art|audio|vfx|shaders|data` 并从代码寻找 `res://` 引用；Unity 扫 `Assets/`，Unreal 扫 `Content/*.uasset` / `*.umap`。后两者的引用多存在场景、Prefab 或其他资产中，当前扫描器不能用代码搜索确认孤立资产。

## 运行扫描器，再读每行状态

`asset-scan.sh` 输出 TSV 观察值：`engine`、`root`、`scanned`、`category`、`check`、`hits`，以及 `NAMING`、`POT`、`SIZE`、`DIM`、`ORPHAN`、`MISSING`、`NOTREAD` 等行。`hits` 是相应观察行数量；未执行的检查用 `-`，不会用 0 伪装成“检查后没有问题”。退出码 0 表示扫描完成，即使有命中也不代表合规。

脚本头部明确写着只输出观察值，不负责最终 verdict。`/asset-audit` Skill 才按顺序判定：任何大小超标或代码引用的资产不存在，先归为 `NON-COMPLIANT`；只有命名、格式或孤立资产发现时是 `WARNINGS`；扫描范围缺数据或存在未评估部分则为 `NOT ASSESSED`；只有至少扫描到一个资产、所有适用检查都有结论且无发现，才是 `COMPLIANT`。已确认的严重发现优先于另一个未评估项。

## 实践：扫描一个合成 Godot 项目

运行：

~~~sh
python3 learn_claude_code_game_studios/practice/exercise_asset_audit.py
~~~

练习脚本在系统临时目录构建合成项目，生成三张合法 PNG，并运行当前 CCGS 快照的真实 `asset-scan.sh`。样例 art bible 给出 256 字节纹理预算和 8 像素最大边长；扫描器从 `project.yaml` 识别 Godot，并使用传入的预算参数。项目包含一个大小/尺寸超标纹理、一个大小写与 POT 尺寸问题、一个未被代码引用的文件和一个缺失引用。另跑一次空资产目录，观察 `scanned 0` 和 `hits -` 的区别。

本地快照中 `asset-audit/SKILL.md` 没有调用 `asset-scan.sh`，其工具声明也只列出手工测量命令。课程实践直接运行扫描脚本，演示它实际提供的 TSV 证据；这不等于 Claude Code 执行了 `/asset-audit`。请根据 Skill 的优先级自行判断样例报告 verdict。

核对答案：有一个超出字节预算的纹理，也有一个代码引用但不存在的路径，因此填入 Skill 报告时应判 `NON-COMPLIANT`。命名、尺寸或其他检查未评估，不会抵消这两个已测到的发现。空目录则没有扫描到任何资产，Skill verdict 应为 `NOT ASSESSED`，不能判 `COMPLIANT`。

## 本课结论

可靠的资产审计结论来自具体范围、实际测量和 Skill 中明确的判定顺序。脚本成功运行不代表每个审计面都覆盖；`NOT ASSESSED` 和 `not_run` 保留了工具无法证明的部分，不能被压成绿色结果。

## 简化说明

- 实践使用 CCGS 1.2.0 快照的真实只读 `asset-scan.sh`，但没有启动 Claude Code Skill。
- PNG 是练习脚本临时生成的合成文件；报告路径、代码引用和尺寸标准仅用于演示。
- 扫描器不能验证 PNG 的视觉质量、音频时长、JSON/YAML schema、引擎导入状态或编辑器中的实际引用。
- Godot 的类别化美术/音频命名 pattern 在当前 helper 中被标为不可检查；Unity/Unreal 的场景内引用也不会被代码搜索证明。
- 任何 verdict 都应回到 `asset-audit/SKILL.md` 的规则；helper 本身不作合规判断。

## 自测

1. `/asset-audit` 与 `/content-audit` 的扫描对象分别是什么？
2. `hits missing 0` 与 `check missing not_run` 代表同一件事吗？
3. 为什么 `asset-scan.sh` 退出码 0 不能单独得出 `COMPLIANT`？
4. 一个大小超标文件与一个未评估格式项同时存在，Skill 的优先 verdict 是什么？
5. 为什么代码没有引用某个 Unity/Unreal `.uasset` / Prefab 不能证明它孤立？
