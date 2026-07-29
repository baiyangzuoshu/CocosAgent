# MVP 路线图

## 阶段 0：项目基线

目标：建立可重复的开发和测试环境。

- 初始化 CocosAgent 代码仓库和 `AGENTS.md`。
- 将 `engine2.4.15/` 标记为只读参考目录。
- 完善 `cocos-2.4.15-demo/assets/` 基准内容。
- 建立格式、类型、单元测试和打包任务。
- 固定 Creator 路径配置，但不在生产代码中硬编码 macOS 路径。

验收：新机器可通过配置选择 Creator 2.4.15，并识别 Fixture 项目。

## 阶段 1：只读项目理解

- 实现 Creator 项目识别和版本校验。
- 索引 Scene、Prefab、Script、Texture、Audio 和 Animation。
- 解析 `.meta` 的 UUID 摘要，不修改文件。
- 注册 `cocos_project_inspect` 和 `cocos_assets_list`。
- 为 Cocos 项目增加专用系统提示。

验收：Agent 能回答测试项目结构问题，输出有界且不读取生成目录。

## 阶段 2：Creator Bridge 只读连接

- 实现 `cocos-agent-bridge` 最小 Creator package。
- 完成 loopback 会话、token、协议和能力协商。
- 实现 `system.ping`、`project.describe`、`scene.tree`、`asset.query` 和日志读取。
- 实现 Bridge 客户端超时、取消和错误分类。

验收：Creator 打开测试项目时，Agent 能读取当前场景树和编辑器错误。

## 阶段 3：安全脚本工作流

- 创建和修改 TypeScript/JavaScript 组件。
- 等待 Creator 编译并获取错误摘要。
- 增加脚本模板和 Cocos 2.4.15 API 约束。
- 验证取消后无遗留构建或预览进程。

验收：Agent 能创建 `TestComponent.ts`、等待编译并报告结果。

## 阶段 4：场景写操作

- 实现节点创建、组件挂载和属性修改。
- 实现操作预览、审批、恢复点、保存和重新读取验证。
- 实现 Scene 写锁和 AssetDB 刷新互斥。
- 首期只开放白名单组件与属性。

验收：重复运行“创建 Label 并设置文本”不会损坏场景，失败可恢复。

## 阶段 5：资源、预览与构建

- 导入品牌图标并通过 AssetDB 获取 UUID。
- 将图片设置到 Sprite。
- 启动 Web Preview 并采集日志。
- 支持 Web Desktop 和 Web Mobile 构建。
- 返回产物路径、耗时和错误摘要。

验收：Agent 能在测试场景展示 CocosAgent 图标并完成 Web 构建。

## 阶段 6：Prefab 与视觉验证

- 通过 Creator API 创建和更新 Prefab。
- 实现引用和实例关系检查。
- 增加预览截图与视觉 QA。
- 增加资源依赖图和未使用资源分析。

验收：Agent 能创建 `TestPanel.prefab`、实例化并在重新打开场景后保持一致。

## 发布门槛

MVP 发布前必须满足：

- 所有写工具都有明确权限分类。
- Bridge 只监听回环地址。
- Scene/Prefab 通用文件写入被硬拒绝。
- 取消路径无遗留子进程。
- Fixture 端到端测试连续通过。
- macOS 应用完成本机启动、Keychain、Creator Bridge、预览和构建验收。
