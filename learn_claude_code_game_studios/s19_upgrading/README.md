# 第 19 课：升级与兼容

**目标：** 使用版本记录规划 CCGS 升级，并识别共享配置和用户内容的保护边界。

## 源码位置

- `engine/Claude-Code-Game-Studios/UPGRADING.md`：升级策略和文件处置建议。
- `CHANGELOG.md`：各版本具体变化。
- `project.yaml`：`framework.version` 与最后升级日期。
- `.gitignore`、`.worktreeinclude`：本地设置和工作树配置处理。

## 观察步骤

1. 从 `framework.version` 确认项目当前框架版本。
2. 在 Changelog 中找到升级区间，列出行为和路径变化。
3. 对照 UPGRADING 的 Safe to Overwrite、Merge Carefully 和自有内容。
4. 为 `CLAUDE.md`、`project.yaml`、本地配置和 skills 制定各自的保留/合并策略。

## 观察结果

升级不等于把模板目录全部覆盖。脚本或默认模板可能适合替换，项目配置和已定制的 Skill 需要对比合并；版本号、迁移步骤和本地差异都应可追溯。

## 实践

如果有两个版本的源码快照，运行 `python3 learn_claude_code_game_studios/practice/compare_snapshots.py <旧版目录> <新版目录>`。先按路径列表找出新增、删除和变化的文件，再对照 `UPGRADING.md` 分类哪些能替换、哪些要人工合并。没有旧快照时，先对 `practice/workspace/` 与当前源码目录做一次比较，熟悉报告格式。

## 简化说明

本课不执行升级、不抓取上游，也不覆盖本地文件。升级流程以当前 `UPGRADING.md` 为准，不能把某次版本的文件清单套用于未来版本。

## 自测

给共享配置、本地覆盖和自定义 Skill 各选一种处理策略，并说明直接 checkout 覆盖可能丢失什么。
