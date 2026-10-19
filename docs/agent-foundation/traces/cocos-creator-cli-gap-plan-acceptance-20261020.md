# Cocos CLI 差距计划阶段验收记录

日期：2026-10-20。目标：按 CLI 与 Unity CLI 的差距分阶段补齐 Cocos CLI 的独立分发/运维、Creator 写入与运行反馈、构建测试、异步任务与恢复能力。

## 已完成的本机验收

- CLI 包版本：`0.6.0`；Creator 命令合同目标：`2.4.15`；Node.js `22.22.2`，满足 `>=20`。
- `npm pack --dry-run --json` 显示 tarball 含 17 个发布文件，未包含测试夹具；包体 54,942 bytes，展开 245,038 bytes。
- 本地发布 tarball：`cocos-creator-agent-cli-0.6.0.tgz`；SHA-256：`af43b9854edf7a4dbf54fc1eff1b14256e6e415ea63454e7adddf02386cdd856`。
- 从仓库 `HEAD` 的 CLI 包 `0.1.0` 制作本地旧版 tarball，安装到隔离 npm prefix，再将同一 prefix 升级到本次 `0.6.0` tarball。升级后 `version --format json` 返回 CLI `0.6.0`、Creator `2.4.15`；catalog 返回 19 条 Creator 命令。
- 最终 tarball 安装到本机全局 npm 后，`version` 返回 `0.6.0`。`doctor --format json`：6 项通过、0 警告、0 错误；Node、npm、包版本、扩展模板 `0.4.0`、合同指纹和 loopback bridge 均匹配。当前找到 0 个已连接 Creator 实例。
- 新增自动化测试：`npm test` 共 8 项通过，覆盖构建回执与路径保护、Creator patch 版本拒绝、原生编译目录/autoCompile 约束、项目工具只读 schema 与注册哈希、MCP 项目别名发现及路由、异步任务进度等待、派发前取消、桥接重启后只读恢复和写入 reconcile（不重放）。这些桥接/Creator 交互由隔离工程中的协议模拟器提供，不等于 Creator 实机验收。CLI、桥接及 MCP 文件 `node --check` 通过。
- 以安装后的 CLI 启动更新 MCP server，通过 stdio JSON-RPC `initialize` 与 `tools/list` 收到 30 个工具，schema 含 `cocos_tasks_wait`。Codex 当前会话的 `cocos_cli_status` 实际返回 CLI `0.6.0`，但仍只公布旧的 8 个工具；新目录尚未在 Host 重载验收。

## 扩展生命周期验收

此前隔离项目 `/private/tmp/cocos-cli-acceptance-rhrGB0` 已用 CLI 验收扩展安装、匹配状态、幂等更新、漂移默认拒绝、强制操作前备份及漂移卸载拒绝/强制备份。该记录对应的隔离操作没有写入 `tank`。

## Creator 实机验收阻塞

本轮未通过 Creator 工具完成写入、编译、诊断、预览、截图或同会话输入验收。

- Cocos Dashboard 中 `tank` 行报告 Creator `2.4.15`，但可访问性路径显示 `/Users/youjunmao/WORK/Cocos_Engine`，不是本任务锁定的 `/Users/youjunmao/WORK/Cocos_Engine/tank`。`project.json` 所在目录和 `realpath` 是后者；这不能消除 Dashboard 报告的不一致。
- 根据仓库工程身份规则，停止从 Dashboard 打开项目以及调用 Creator 项目工具。当前 CLI 报告 0 个 Creator 实例。
- 在本轮发现 Dashboard 不一致之前，`tank/packages/cocos-creator-agent-extension` 已由 CLI 从未托管的 `0.1.0` 更新到 `0.4.0`，并生成 `.cocos-creator-agent-install.json`。操作使用 `--force`，更新前完整备份位于 `/private/tmp/cocos-tank-baseline-20261020/cocos-creator-agent-extension-0.1.0`，CLI 备份位于 `/private/tmp/cocos-tank-cli-home/.cocos-creator-agent/extension-backups/`。更新没有改动场景或 `assets/`。基线 `project.json` SHA-256：`23b38e35508f2acc9c369961e5664043bd46bb5c9173abc0f35c28e50bb4dd60`；原扩展各文件哈希见 `/private/tmp/cocos-tank-baseline-20261020/baseline.json`。

要继续 Creator 实机验收，Dashboard 必须先准确报告锁定的项目名、完整路径、Creator 2.4.15 和打开状态；之后再在对应编辑器确认版本及扩展报告工程路径。此检查完成前，不得把源码、隔离测试、CLI health 或 Dashboard 外的文件系统结果描述成 Creator 验收。

## 分发发布状态

本地发布包、SHA-256 和隔离 npm 安装升级已验证。GitHub Release 尚未创建：`git ls-remote origin` 被远程以 `Invalid username or token` 拒绝，GitHub API 对仓库返回 404。随后推送 `main` 与版本标签的请求被自动审核拒绝，因为它会发布整个未审查主分支，而当前批准范围仅明确到 CLI Release；未尝试通过其他上传路径绕过。当前 tag `cocos-creator-agent-cli-v0.6.0` 仅在本地；GitHub Actions 未运行，不能声称有可下载的 Release tarball 或线上 checksum 资产。
