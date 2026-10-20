# Cocos Creator Agent CLI 0.9.0 本机分发验收

日期：2026-10-20。范围：CLI 0.9.0 源码测试、本地包、隔离安装/升级、当前 Host 配置和 Creator 工程身份。未把本机包结果描述为 GitHub Release、桌面 Host 重载或 Creator 实机验收。

## 测试与包

- 运行环境：Node.js `v22.22.2`。在 `tools/cocos-creator-agent-cli/` 执行 `npm test`：**32/32 通过**。3 项 loopback 集成测试在受限沙箱内因 `listen EPERM 127.0.0.1` 失败；在允许本机回环端口的环境重跑后全部通过。
- 0.9.0 包：`cocos-creator-agent-cli-0.9.0.tgz`，npm pack 报告 90 个文件、包体 160,686 字节、解包 680,010 字节。
- SHA-256：`51c059ff2cf9adab8bacb60c2f79df05d4767d3e90d72092d2dada3068e2c9f9`。
- 包清单包含 CLI/MCP/桥接、Creator 扩展模板及 Provider 合同、52 个 Skill 文件和 13 份 Creator 2.4.x 专题参考资料（另含参考索引 README）。
- 使用隔离 npm cache 与 prefix 安装最终 tarball 后，`version --format json` 返回 `0.9.0` / Creator `2.4.15`；`skill show --list` 返回 52 个 Skill；`catalog --format json` 返回 30 个 Creator 命令。
- 在同一隔离 prefix 先安装 Git tag `cocos-creator-agent-cli-v0.6.0` 打包的 CLI，确认版本 `0.6.0`，再安装最终 0.9.0 本机 tarball，确认升级后版本 `0.9.0`。这是本地 tarball 升级测试，不是 Release URL 的在线自更新测试。

## 当前客户端配置核对

- `cocos-creator-agent mcp status codex` 返回 `different-configuration`。真实 Codex CLI 的 `mcp list` 显示同名服务仍指向缓存插件的 `mcp/server.mjs`，不是 CLI 自有 MCP server。
- 真实 Claude Code CLI 的 `mcp list` 返回 `No MCP servers configured`。
- 本轮没有强制覆盖真实用户配置：0.9.0 尚未发布，当前隔离安装目录不是持久的正式安装路径；旧同名项应在发布安装完成后通过 CLI 明确迁移。桌面 Host 工具目录也尚未重载验收。

## Release 状态

- 本地仅存在 `cocos-creator-agent-cli-v0.6.0` 标签；0.9.0 Release 尚未创建。
- 仓库现有 GitHub Actions Release workflow 监听 `cocos-creator-agent-cli-v*` 标签，校验标签与 package 版本一致，打包 tarball 并上传归档和 SHA-256。workflow 现增加发布前 `npm test`；另增 CLI 路径范围 CI workflow，运行测试与 npm 包清单检查。
- 本地环境没有 `gh` CLI，因此 Release 由推送匹配标签后 GitHub Actions 发布。Release 资产、`self-update --check`、在线安装和指定版本回滚仍待远端 workflow 完成后验收。

## Creator 实机边界

- Cocos Dashboard 当前列出项目名 `tank`、Creator `2.4.15`、状态“已打开”，路径为 `/Users/youjunmao/WORK/Cocos_Engine`。
- 本轮锁定路径为 `/Users/youjunmao/WORK/Cocos_Engine/tank`。路径栏不匹配，因此依照仓库 `AGENTS.md` 停止，不进入 Creator、不调用扩展或项目工具，也不读取/写入该工程。
- Provider IPC 握手、Creator 原生审批、写入、编译/Console 回读、预览截图和同会话输入断言均未获得本轮实机证据。
