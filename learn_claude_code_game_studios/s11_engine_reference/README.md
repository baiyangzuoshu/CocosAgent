# 第 11 课：引擎参考资料与版本边界

**目标：** 根据项目选择正确的引擎参考目录，读懂版本钉定信息，并判断这些资料能否代表项目实际安装的引擎。

完成本课后，你应该能：

1. 从项目配置确认引擎名称与版本，再定位对应的 `VERSION.md`。
2. 区分文档版本、项目声明版本、本机安装版本和模型知识截止日期。
3. 按 API 风险选择弃用清单、破坏性变更、最佳实践及模块/插件资料。
4. 遇到 CCGS 未覆盖的引擎时，明确标记资料缺口，不把相近引擎资料当成替代。

## 问题

引擎 API 会随版本变化，模型记忆和项目使用的版本也可能不同。仅打开一份 `VERSION.md` 还不能证明本机安装了该版本；只看到 `CLAUDE.md` 导入 Godot 资料，也不能断言任意接入 CCGS 的游戏都是 Godot 项目。需要从项目引擎配置、版本参考和具体 API 文档三处交叉核对。

## 源码位置

| 文件 | 本课观察点 |
| --- | --- |
| `engine/Claude-Code-Game-Studios/docs/engine-reference/README.md` | 参考资料目录结构、维护要求和质量规则 |
| `docs/engine-reference/{godot,unity,unreal}/VERSION.md` | 引擎 Pin、安装版本状态、验证日期、知识截止与风险时间线 |
| `engine/Claude-Code-Game-Studios/project.yaml` | 项目引擎配置的主存储位置；区分 CCGS 框架版本与游戏引擎版本 |
| `engine/Claude-Code-Game-Studios/CLAUDE.md` | `ENGINE-REFERENCE-IMPORT` 当前指向什么，以及模板默认值的说明 |
| `.claude/docs/technical-preferences.md` | `project.yaml` 缺少字段时的人类可读旧式后备值 |
| `.claude/skills/setup-engine/references/3-version.md`、`4-claude-md-stack.md`、`5.5-project-yaml.md` | 如何查版本、记录配置并改写参考资料导入 |
| `.claude/agents/unity-specialist.md` | 引擎专家实际查阅版本、API 与子系统资料的顺序 |

## 一、资料目录回答什么问题？

`docs/engine-reference/README.md` 将目录定义为按版本钉定的引擎资料快照。每个引擎目录用不同文件回答不同问题：

| 文件 | 用途 |
| --- | --- |
| `VERSION.md` | 记录资料针对的引擎版本、LLM 知识截止、验证日期、安装版本是否确定及版本风险 |
| `deprecated-apis.md` | 查找不应继续使用的 API 及替代方式 |
| `breaking-changes.md` | 查找版本迁移中发生的行为或 API 变化 |
| `current-best-practices.md` | 查阅当前实践与模型训练资料可能遗漏的做法 |
| `modules/*.md` | 查阅物理、渲染、音频等子系统资料 |
| `plugins/*.md` | 查阅 Unity/Unreal 等具体插件资料 |

参考资料索引还要求记录 `Last verified`、提供官方文档来源，并控制模块文件长度。它的目标是让 Agent 在需要某个 API 时按需读到相关证据，不代表每一条上游文档或所有引擎版本都已覆盖。

## 二、版本字段不能互相替代

本地 CCGS 1.2.0 快照中的 `VERSION.md` 给出以下 Pin：

| 资料目录 | Engine Version | Installed at pin time | LLM Knowledge Cutoff |
| --- | --- | --- | --- |
| `godot/` | Godot 4.7 | `NOT DETERMINED` | May 2025 |
| `unity/` | Unity 6.3 LTS | `NOT DETERMINED` | May 2025 |
| `unreal/` | Unreal Engine 5.8 | `NOT DETERMINED` | May 2025 |

`Engine Version` 是资料所针对的版本；`Installed at pin time` 记录生成 Pin 时是否探测到本机安装版本。这里均为 `NOT DETERMINED`，所以不能声称本机装有这些版本。`Project Pinned` 与 `Last Docs Verified` 是两类日期，也不能当作当前编辑器版本。

例如 Unity 的资料目录仍 Pin 在 6.3 LTS，即使文件里还记录了更晚的 Unity 6.4–6.7 发布信息，也不表示参考目录自动升级到了这些版本。版本说明应连同其日期和验证范围一起读。

## 三、先确认项目，再选择参考目录

按这个顺序定位资料：

1. 先看项目根目录 `project.yaml` 的 `engine.name` 和 `engine.version`。CCGS 将其定义为机器可读主配置。
2. 若字段缺失，再按 CCGS 的配置合同检查 `.claude/docs/technical-preferences.md` 后备信息；占位文本不是有效的引擎选择。
3. 读取 `docs/engine-reference/<engine>/VERSION.md`，比较项目版本与资料 Pin，并检查 `Installed at pin time`、知识截止和验证日期。
4. 根据任务继续查 `deprecated-apis.md`、相关 `breaking-changes.md`、`current-best-practices.md`，再查对应 `modules/` 或 `plugins/` 文件。
5. 若项目版本不在资料覆盖范围内，或所需 API 没有来源，就标记需要核验/未验证；不要仅凭训练记忆断言兼容。

`CLAUDE.md` 的 `ENGINE-REFERENCE-IMPORT` 控制会话加载哪份版本摘要。模板注释说明当前 Godot 导入是示例默认值，`/setup-engine` 会将它改成选定引擎。因此导入路径反映模板/项目的上下文接线，不取代项目配置，也不检测本机安装。

## 四、当前 CCGS 快照的配置边界

检查本地快照可以看到：

- `project.yaml` 配置了 CCGS `framework.version: 1.2.0`，但没有根级 `engine.name` 或 `engine.version`。
- `technical-preferences.md` 的 Engine 字段仍是 “TO BE CONFIGURED”。
- 根级 `CLAUDE.md` 当前默认导入 `docs/engine-reference/godot/VERSION.md`，注释称它是模板示例引擎。
- 参考目录只有 Godot、Unity、Unreal；没有 Cocos Creator 参考目录。

因此，本课程所读的 CCGS 模板没有配置一个实际游戏引擎。不能把 `framework.version: 1.2.0` 当作游戏引擎版本，也不能因为默认导入 Godot 文件就宣称当前工程是 Godot。若接入的是 Cocos Creator 项目，CCGS 这份参考索引没有 Creator API 覆盖范围；应转到对应 Creator 版本的正式资料，不能拿 Godot/Unity/Unreal 文档顶替。

## 实践一：盘点版本索引与配置状态

从仓库根目录运行：

~~~sh
python3 learn_claude_code_game_studios/practice/inspect_engine_reference.py
~~~

脚本静态读取项目引擎配置、`CLAUDE.md` 的参考导入，以及每个 `VERSION.md` 的版本字段和文档数量。当前快照应显示项目引擎未配置、默认导入为 Godot，并列出 Godot 4.7、Unity 6.3 LTS、Unreal 5.8 三套资料；三者的安装版本均未确定。

再单独筛选 Unity 目录：

~~~sh
python3 learn_claude_code_game_studios/practice/inspect_engine_reference.py --engine unity
~~~

`--engine` 只筛选要看的资料目录，不会侦测项目类型。若用它查看示例资料，请在记录里注明这是练习筛选值，不是本地游戏项目的引擎配置。

再核对 Cocos Creator 是否有对应的 Pin：

~~~sh
python3 learn_claude_code_game_studios/practice/inspect_engine_reference.py --engine cocos-creator
~~~

当前快照应报告没有 `cocos-creator` 参考目录，并列出它实际拥有的三个引擎目录。这个结果只表示当前快照没有这类引擎 API 资料。

## 实践二：手动追一条版本到子系统资料的路径

~~~sh
rg -n '^engine:|^  (name|version):|framework:|^  version:' engine/Claude-Code-Game-Studios/project.yaml
rg -n 'Engine:|ENGINE-REFERENCE-IMPORT|@docs/engine-reference/.*/VERSION.md' engine/Claude-Code-Game-Studios/CLAUDE.md engine/Claude-Code-Game-Studios/.claude/docs/technical-preferences.md
sed -n '1,45p' engine/Claude-Code-Game-Studios/docs/engine-reference/README.md
sed -n '1,45p' engine/Claude-Code-Game-Studios/docs/engine-reference/unity/VERSION.md
sed -n '1,45p' engine/Claude-Code-Game-Studios/.claude/agents/unity-specialist.md
sed -n '1,100p' engine/Claude-Code-Game-Studios/docs/engine-reference/unity/modules/physics.md
~~~

完成下面记录：

| 核对项 | 观察结果 |
| --- | --- |
| CCGS 框架版本 |  |
| 项目 `engine.name` / `engine.version` |  |
| CLAUDE.md 默认参考导入 |  |
| 选定引擎的 `Engine Version` |  |
| `Installed at pin time` 是否已知 |  |
| Unity 物理任务接下来应读的文件 |  |
| 资料能否证明本机编辑器已安装且可构建 |  |

## 本课结论

把 `project.yaml` 中项目所用的引擎/版本作为定位起点，再用对应 `VERSION.md` 看参考资料覆盖与风险，最后按 API/子系统读取相关资料。始终分开记录项目声明版本、资料 Pin、本机安装版本和模型知识截止。当前快照未配置具体游戏引擎；Godot 的默认导入不改变这一点。

## 简化说明

- `inspect_engine_reference.py` 只静态读取 YAML 中简单的根级 engine 字段、CLAUDE 导入行和 `VERSION.md` 表格；不加载完整 YAML schema，也不模拟 Claude Code 的上下文导入。
- 本课结论对应本地 CCGS 1.2.0 快照；资料中记载的发布/验证日期是快照内容，不是实时更新查询。
- 本课未探测 Godot、Unity 或 Unreal 的本机安装，也未创建游戏工程、编译或运行示例。`NOT DETERMINED` 必须保留为未知，不能改写成“没有安装”。
- CCGS 当前索引没有 Cocos Creator 参考目录；这仅说明本快照缺少 Creator 的引擎 API 资料，不代表 CCGS 工具本身不能用于其他项目。

## 自测

1. `project.yaml` 的 `framework.version` 与 `engine.version` 分别指什么？
2. `VERSION.md` 写着 Engine Version 4.7、Installed at pin time 为 `NOT DETERMINED` 时，哪些结论成立，哪些还未知？
3. 为什么当前 `CLAUDE.md` 导入 Godot 版本文件，不能单独证明游戏项目使用 Godot？
4. 查询物理 API 时，为什么要从对应的 `VERSION.md` 继续读 `modules/physics.md` 和弃用/变更记录？
5. Cocos Creator 项目应如何处理当前 CCGS 参考目录的缺项？
