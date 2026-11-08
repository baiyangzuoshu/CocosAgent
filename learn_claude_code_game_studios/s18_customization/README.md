# 第 18 课：定制 CCGS

**目标：** 设计一个范围明确的框架改动，并为其指定适当的检查方法。

## 源码位置

- `engine/Claude-Code-Game-Studios/README.md` 的 Customization 部分。
- `.claude/agents/`、`.claude/skills/`、`.claude/hooks/`、`.claude/rules/`：扩展入口。
- `.claude/rules/skill-authoring.md`：Skill 与 Agent 内容质量约束。
- `studio-tests/templates/`、`catalog.yaml`：新增行为规范的模板和注册表。

## 观察步骤

1. 选择一项需求，例如增加项目专用 Skill 或路径 Rule。
2. 确定应修改哪个层，不把规则、事件处理和流程文档混在一起。
3. 为新 Skill/Agent 指定输入、输出、边界及其 studio-test 检查。
4. 读 `validate-skill-change.sh` 对框架文件修改的提示。

## 观察结果

CCGS 是可定制模板，但改动需保留职责分层。新增 Skill 不只是增加一个 Markdown 文件：还要考虑索引、依赖、工具权限、合同、测试覆盖和升级维护。

## 实践

只在副本中新增 `.claude/skills/lab-check/SKILL.md`：让它完成一个只读的小检查，写清输入、步骤、允许工具和输出。然后运行 `/skill-test static lab-check`；按报告修正 Skill，并再次运行同一检查。

## 简化说明

本课只设计改动方案，不编辑 `engine/Claude-Code-Game-Studios/`。具体写入路径和跨文件范围应按任务要求单独处理。

## 自测

提出一个新 Skill，列出它需要的入口文档、可能的合同/reference、测试方式和不应承担的职责。
