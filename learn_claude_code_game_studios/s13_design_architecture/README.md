# 第 13 课：从概念到架构

**目标：** 追踪游戏概念、系统设计、架构决策和实现约束之间的关联。

## 源码位置

- `engine/Claude-Code-Game-Studios/docs/WORKFLOW-GUIDE.md`：概念与系统设计阶段。
- `.claude/skills/brainstorm/`、`map-systems/`、`design-system/`、`architecture-decision/`、`create-control-manifest/`。
- `.claude/docs/templates/`：game brief、GDD、ADR、control manifest 等模板。
- `docs/architecture/tr-registry.yaml`：稳定的技术要求 ID。

## 观察步骤

1. 从概念文档列出一个系统需求，追到系统索引和对应 GDD。
2. 找到支撑该系统的 ADR，区分 Proposed、Accepted、Superseded。
3. 在 TR Registry 找到稳定要求 ID，并查看 Story 如何引用它。
4. 检查 control manifest 如何把架构决定转成程序员可执行的规则。

## 观察结果

设计和架构材料不是孤立的文档。GDD 描述行为，ADR 记录不可轻易更改的决策，TR ID 连接需求与实现，control manifest 汇总分层约束；后续 Story 用这些来源校验范围。

## 实践

在副本中运行 `/brainstorm`，选定一个简短概念并批准写入 brief。再运行 `/map-systems`，选一项 MVP 系统，追踪它生成的系统索引条目；不要在没有用户决定的情况下替概念添加新支柱。

## 简化说明

本课追踪一个要求，不完整评审 GDD 或 ADR。规则细节应按对应文件章节读取。

## 自测

任选一条 TR ID，画出“设计要求 → ADR/架构约束 → Story → 完成检查”的引用链。
