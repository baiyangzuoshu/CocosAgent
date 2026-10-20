# Cocos CLI 0.10.0：目标推进与验收

日期：2026-10-20。原始结构化回执、输入结果与文件哈希见[JSON 记录](cocos-cli-0.10.0-goal-20261020.json)。本轮未把 Node 测试、接口模拟或本机包描述为 Creator 运行时/线上 Release 验收。

## 已完成

- 独立 CLI 增加 `.cocos-agent/tests.json` 项目测试计划；Node 子进程、需 Creator 原生审批的项目 Provider、预览同会话断言三种适配；JSON/JUnit、时间、身份、manifest/测试文件哈希；空报告/全跳过/异常退出/超时/取消拒绝误报成功。
- watch 增加受限目录观察，检测新增、修改、重命名与删除；按依赖重跑套件；每轮报告独立。Creator Provider 执行中断后标记人工审阅并停止 watch，不自动重放。
- 桥接保留短期、有限的拒绝握手诊断；`instances list` 与 `doctor` 报告旧扩展实际路径、版本和不匹配原因。这类记录没有 session、能力或命令权限。
- Node.js 22.22.2 完整 CLI 测试 **41/41 通过**，包括真实 Node 测试子进程、取消/超时、目录变化和拒绝握手不得调用命令的回环 HTTP 集成测试。
- 本地 CLI 0.10.0 tarball 94 文件，170667 字节，解包 717765 字节。SHA-256：`8bb6dab07ceb0a21e8de6bbfa0143ceb64e75c684e9b01986ea6cfcd2225af3d`。已检查测试模块、reporter、Creator helper 和测试合同都进入包；安装后逐项核对 94 文件哈希均与源码一致。
- 全局安装从原有 0.6.0 经本地 0.9.0 升至本地 0.10.0。0.9.0 包重打哈希仍为 `51c059ff2cf9adab8bacb60c2f79df05d4767d3e90d72092d2dada3068e2c9f9`。
- 真实 Codex 与 Claude 用户级 MCP 均由 CLI 配置到 `/opt/homebrew/lib/node_modules/cocos-creator-agent-cli/cli.mjs mcp serve`，配置检查均为 `configured`。两者安装/刷新 52 项 Skills 及共享参考资料；当前聊天的 `cocos_cli_status` 实际返回 CLI 0.10.0。安装后的 CLI-owned MCP server 经真实 stdio initialize/tools/list/tools/call 验收，版本 0.10.0、36 个工具；当前聊天仍是旧工具目录，尚未声称桌面 Host 已加载新增工具。
- 从安装后的 CLI 执行临时 Node 碰撞逻辑测试：通过时退出 0，故意破坏命中判断后退出 1，JUnit XML 均能解析；watch 实际执行通过→失败→修复通过三轮，最后正常退出。临时夹具不是 Creator 编辑器工程验收。
- 已完成[VCS、资源完整性、模板与资源包评估](../cocos-cli-vcs-template-assets-evaluation-20261020.md)；提出后续合同与验收范围，未把候选命令标成已实现。

## 工程身份纠正与扩展升级

此前把 Dashboard 列表中的父目录显示当成实际工程路径不一致，是错误判断。本轮结合 Dashboard 注册表 `~/.Cocos/profiles/project.json` 的完整工程 key、Dashboard UI 的项目名/版本/已打开状态、Creator 2.4.15 窗口，以及扩展实际注册请求完成核对：

- 工程：`tank`，`/Users/youjunmao/WORK/Cocos_Engine/tank`。
- Creator：`2.4.15`；窗口 `Cocos Creator - tank - Untitled`。
- 原加载扩展：`0.4.0`，实例 `f2265354-88ab-4226-bd78-bdd8b9ad6e15`，握手报告同一完整路径。
- 拒绝原因：`EXTENSION_VERSION_MISMATCH`、`COMMAND_CONTRACT_MISMATCH`；CLI 模板要求 `0.6.0`。

在确认身份后，先将 `project.json`、`assets/`、`settings/`、`packages/` 的原态与 8 项文件哈希保存在 `/tmp/cocos-cli-host-WIJwm5/tank-before` 和 `tank-baseline.json`，再执行 CLI `extension update --force`。磁盘扩展现为 0.6.0；更新回执没有声称已重载。结束时源文件差异只有 6 项扩展安装文件，资产和项目设置无变化。

macOS 随后锁定；自动解锁失败，Package Manager 重载无法完成。仍运行的 0.4.0 扩展被新桥接拒绝，`doctor` 真实报告 7 通过/1 警告/1 错误。Provider IPC、原生审批、写入、编译/Console、预览截图、输入及业务断言尚待实机验收。

## 远端状态与剩余门槛

SSH `git ls-remote` 确认远端 main 已含 `bff2faa71677023b2e54eae037b0d6faa4d899a7`；此前推送等待超时不能据此说该提交未到达远端。远端 0.9.0 标注标签的 peeled commit 为 `3f5baf3712638e0a0ff6d44373c6842d5c81267e`。

公网 API 对仓库元数据、Actions 和 0.9.0 Release 均返回 HTTP 404；当前 Git 凭据助手不可用，GitHub 连接器无可用读取结果，浏览器连接超时。SSH 可读 Git refs，不能证明 Release 资产存在。未更改仓库可见性、令牌或 SSH 主机验证。实际执行 `self-update --check --version 0.9.0` 退出 2，错误 `CLI_RELEASE_HTTP_404`。线上 tarball/SHA-256、自更新和回滚仍未验收；0.10.0 仅为本机安装包，未创建发布标签。

恢复实机工作后仍需：重载已更新的 Creator 扩展，核对版本/合同指纹和工具能力；安装临时项目 Provider 样本并验证发现/审批/写入/恢复；验收 Creator 编译、Console 与同会话运行；重载真实 Host 新工具目录。发布状态可读取后，再执行线上安装、自更新和指定版本回滚。整个目标仍未完成。
