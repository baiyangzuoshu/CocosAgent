# 第 16 课：运行观察与 QA 证据

**目标：** 区分静态检查、自动化测试、构建成功和玩家可见行为的实际观察。

## 源码位置

- `engine/Claude-Code-Game-Studios/.claude/docs/run-and-observe.md`：运行与观察要求。
- `.claude/docs/coding-standards.md`：按 Story 类型定义的测试证据。
- `.claude/skills/dev-story/`、`story-done/`：采集、核对证据的步骤。
- `README.md` 的 “It runs the game and looks at it” 部分。

## 观察步骤

1. 记录某个验收标准是由静态查看、自动测试、人工回答还是截图核对。
2. 找出视觉/UI Story 对保留截图和运行观察的要求。
3. 检查 evidence 路径和 Story 的 `stamp.txt` 用途。
4. 对照不同 rigor 和 testing.strict 设置，区分必需、建议和豁免。

## 观察结果

证据强度必须与结论匹配：源文件存在不代表测试通过，构建通过不代表界面可见，截图只能证明拍摄时的可见状态。玩家可见改动需要运行并观察，相关截图保留在项目的 QA evidence 中。

## 简化说明

本课不启动具体引擎，也不采集实际截图。不同引擎的运行命令和截图位置须按当前项目配置确认。

## 自测

把“逻辑测试文件存在”“构建完成”“按钮显示在屏幕内”分别配到足以支持它的证据。
