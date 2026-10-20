# Cocos CLI 差距计划后续记录

日期：2026-10-20。范围：在 CLI 0.6.0 基线上增加受审批的 Creator 场景组件挂载和公开标量属性写入，更新共享合同、MCP、任务恢复与 Skill，并验收 CLI 0.7.0 本地发布包。

## 本次实现

- 独立 CLI 与 Codex / Claude 插件版本为 `0.7.0`；Creator 项目扩展版本为 `0.5.0`。
- Creator 命令合同共 25 项，SHA-256：`37d6054aca633d622126444fca32f581a948fef15b0ecf1ed23c4f75a46b40ff`。
- 新增 `creator.scene.node.add-component.plan` / `commit` / `reconcile`：从 Creator 类注册表解析组件，绑定场景、节点、类名和前态组件数；拒绝未知类、非组件类、已有实例和隐式 `requireComponent` 依赖。
- 新增 `creator.scene.node.set-component-property.plan` / `commit` / `reconcile`：只允许同一 Creator 扩展会话中的精确组件实例及已声明公开 `string` / `number` / `boolean` 属性；拒绝继承字段、内部字段、对象/数组/资源引用和前态变化。
- 两种提交均显示 Creator 原生审批框，审批后重核工程、会话、目标身份和前态，再经 Scene Script 修改、读回并请求 `scene:stash-and-save`。Creator 2.4 没有该保存 IPC 的文档化完成回执，因此不宣称已持久化到磁盘。
- 组件构造函数、生命周期与属性 setter 属于引擎/项目代码，可能运行。中断写入通过原 operation ID reconcile，不自动重放；组件对象身份变化时要求人工核对。
- MCP 从共享合同发现命令；固定工具数为 36（3 基础 + 25 Creator + 2 项目工具 + 6 任务工具）。CLI 任务恢复路由包含组件挂载和标量属性提交。

## 本机验收

- `node --check`（CLI、桥接、Creator 扩展脚本）、JSON 解析及 `git diff --check` 通过。
- 在 Creator 2.4.15 引擎源码中核实 `CCClass.js` 会把父类 `__props__` 复制给子类，`CCComponent.js` 会将 `editor.requireComponent` 记录为 `_requireComponent`。新增限制拒绝继承属性，并按注册类精确匹配组件实例；这属于本地静态源码证据，不替代编辑器运行验收。
- 新增的 9 项场景组件/属性定向测试通过；全套 `npm test` 为 **17/17 通过**。覆盖合同/schema、组件类与属性白名单、继承字段、实例数量上限、前态冲突、准确读回、MCP 项目工具和组件工具发现、异步任务等待/取消及桥接重启恢复。
- `npm pack` 产物包含 17 个文件，压缩包 60,802 bytes，解包 303,512 bytes。隔离 npm prefix 从仓库 tag 安装 `0.6.0` 后升级至 `0.7.0` 成功；安装后 CLI 报告 `0.7.0`，catalog 报告 25 条 Creator 命令。
- 本地 tarball：`/private/tmp/cocos-cli-070-accept.yJerAI/final2-dist/cocos-creator-agent-cli-0.7.0.tgz`；SHA-256：`be008e6ae9377e5aaade64f092dcd5ca696fa8e473f305b9231a2b5f3dd48899`。这只是本机验收产物，不是公开 Release 资产。
- 全套测试曾因受限沙箱不能监听临时 loopback 服务而失败；获准后重跑，17 项全部通过。

## 尚未验收

- Creator 2.4.15 实机写入未验收：Creator 未运行；此前 Dashboard 对 `tank` 报告的路径与锁定路径不一致。未打开工程、调用 Creator 项目工具、更新 `tank` 扩展或修改其场景/资产。
- Codex / Claude Host 未重载 0.7.0 工具目录；测试验证了 36 个固定工具以及测试项目别名，不代表桌面 Host 验收。
- 当前全局 CLI 仍为 `0.6.0`，未修改全局安装。
- 公开 GitHub Release 尚未发布；线上下载、自更新 checksum 与回滚未验收。
- Creator 审批取消、真实前态冲突、Creator/桥接重启后的写入恢复，编译/Console、预览截图/交互、UI 事件绑定、资源引用与对象/数组字段写入，以及 tank 游戏切片仍待实机验收。
- 工作区已有 `.DS_Store` 和 `tank/packages/cocos-creator-agent-extension/` 差异；本轮未修改或暂存它们，也没有提交 Git。
