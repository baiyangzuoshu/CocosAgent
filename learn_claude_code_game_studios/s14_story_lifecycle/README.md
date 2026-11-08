# 第 14 课：Story 生命周期

**目标：** 追踪一条 Story 从拆分、就绪检查、实现到关闭的完整路径。

## 源码位置

- `engine/Claude-Code-Game-Studios/.claude/skills/create-stories/`：Story 生成与合同。
- `.claude/skills/story-readiness/`：实现前检查。
- `.claude/skills/dev-story/`：实现流程和 `CONTRACT.md`。
- `.claude/skills/story-done/`：完成核验和 `CONTRACT.md`。
- `.claude/docs/templates/story.md`：Story 字段模板。

## 观察步骤

1. 找出 Story 的验收标准、依赖、测试证据和 `## Files`。
2. 对照 readiness 确认哪些问题会阻止实现开始。
3. 读 Dev Story 如何逐项实现、运行检查、观察游戏并记录改动文件。
4. 读 Story Done 如何核对范围、证据、评审与下一条 Story。

## 观察结果

Story 是一个可追踪的交付单元：文件清单限制改动范围，验收标准定义完成条件，证据记录验证结果。`story-done` 不应把“存在测试文件”说成“测试已通过”。

## 简化说明

本课只阅读模板和流程合同，不实现游戏 Story。实际检查还受 workflow、QA level、系统 override 和 review mode 影响。

## 自测

列出关闭一条 UI Story 前至少要核对的三种不同证据，并说明每种证据能证明什么。
