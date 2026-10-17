# LinkUpClient Creator 原生验收前台尝试

日期：2026-10-17。目标工程：`/Users/youjunmao/WORK/GitHub/cc_framework/project/LinkUpClient/LinkUpClient/LinkUpClient`。本记录只登记可观察到的前置检查与阻塞，不代表原生面板验收通过。

## 自动测试

- `tools/cocos-agent-runtime`：执行完整 `npm test`，TypeScript 构建、固定 upstream 基线校验及测试共 **126/126** 通过。该套件包括本轮解释/只读/读写混合意图和工具授权门槛回归。
- `tools/cocos-agent-bridge/mcp`：执行完整 `npm test`，Host、恢复、面板合同、Creator skill/reference 打包校验等 **99/99** 通过。
- 自动测试为模拟 Provider/工具与合同测试，不证明 LinkUpClient Creator 面板链路。

## Creator 原生面板证据

- Cocos Dashboard 显示 LinkUpClient 使用 Creator 2.4.15 且状态为“已打开”。
- 当前可读的 Creator 2.4.15 窗口实际仍显示隔离工程 `CocosAgentNativeAcceptance-20261016` 的 `helloworld` 场景。尝试从 Creator 菜单切换/打开项目后，CUA 对编辑器请求超时；未读到 LinkUpClient Agent 面板、工具回执或实时场景快照。
- 因此本轮 LinkUpClient 原生面板验收结果为**未执行/未通过证据门槛**，不是功能失败，也不能写成通过。

## 磁盘只读证据

- `project.json` 工程名为 `LinkUpClient`；Creator Dashboard 显示版本 2.4.15。
- `AGENTS.md` 长度 8,140 字节；SHA-256：`ae984519b3f1a808dad20546311c11701a031b1ce749f741f2a117a6aefa6f14`。
- 检查时工程 Git 状态为 `main...origin/main [behind 1]`，包含既有 `assets/BundleLLK/Art.meta` 删除、`packages/cocos-agent-bridge/` 未跟踪和三个 `.cocos-agent-bridge.rollback-*` 回滚目录。本次未修改或清理这些文件。
- 工程中存在 `assets/LinkUp.fire` 与 `assets/BundleBootWeb/BootWeb.fire`；没有据磁盘推断哪一场景是 Creator 当前活动场景。

## 未完成路径

待 LinkUpClient Creator 2.4.15 前台可读后，从面板逐项验证：

1. 当前工程、活动场景、选择上下文与面板实际运行扩展指纹。
2. 按需读取 `AGENTS.md`；对约定哈希变化的写操作，在工具分发前拒绝且零副作用。
3. 取消期间等待当前工具回执并停止后续调度。
4. 按精确 operation ID 读回/恢复；Host 重启后会话与恢复状态仍可核对。
5. 从 LinkUpClient 实时场景快照取目标，生成新计划；经 Creator 面板逐项批准后复跑任务，并核对编辑器、磁盘和同一 operation ID 账本。

未开始上述面板步骤；不复用研究或隔离工程 UUID，不改动 LinkUpClient 项目，不从历史模型对话推断目标。
