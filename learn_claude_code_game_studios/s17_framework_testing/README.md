# 第 17 课：测试 Agent 与 Skill

**目标：** 理解 `studio-tests/` 检查的是 CCGS 框架本身，并辨认不同检查模式的覆盖边界。

## 源码位置

- `engine/Claude-Code-Game-Studios/studio-tests/README.md`：目录用途和命令。
- `studio-tests/catalog.yaml`：Agent/Skill 测试覆盖表。
- `studio-tests/quality-rubric.md`：分类质量标准。
- `.claude/skills/skill-test/SKILL.md`、`skill-improve/SKILL.md`：测试入口。

## 观察步骤

1. 对照 static、spec、category、audit 四种 `/skill-test` 模式。
2. 选一个 skill 分类，读它的质量指标和通过条件。
3. 检查 catalog 如何记录 spec 路径和上次测试结果。
4. 区分 `/skill-test` 与游戏项目的 `tests/`。

## 观察结果

`studio-tests/` 验证 Agent/Skill 的结构和行为约定；它不运行由这些工具制作的游戏。修改框架后应按改动类型选择静态检查、行为规范或分类 rubric。

## 简化说明

本课阅读测试框架，不实际运行 `/skill-test`。行为规范检查也不等同于对游戏功能的自动化测试。

## 自测

写出一种 Skill 结构错误、一种行为偏差和一种游戏 bug，并分别选择正确的验证位置。
