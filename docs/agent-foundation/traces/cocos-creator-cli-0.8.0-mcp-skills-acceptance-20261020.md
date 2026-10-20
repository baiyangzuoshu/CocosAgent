# Cocos Creator CLI 0.8.0 MCP 与 Skills 验收记录

日期：2026-10-20。范围：CLI-owned MCP、Codex/Claude 原生 MCP 配置、CLI 打包 Skills 安装及本机 MCP 协议。所有 Host 配置和 Skill 安装都在 `/private/tmp` 隔离目录中进行，未修改真实用户 Codex/Claude 配置，也未打开或修改 Creator 工程。

## 实现

- 将 stdio MCP server 移入 `tools/cocos-creator-agent-cli/mcp/server.mjs`；CLI 通过 `mcp serve` 启动。
- 增加 `mcp configure/list/status/remove`。配置通过 Codex / Claude Code 原生命令写入；检查同名服务配置，默认拒绝漂移覆盖；支持 `--dry-run`，只有显式 `--force` 才替换冲突项。Codex 配置限用户级；Claude Code 支持用户级及 `--local` 工程级。
- 将 51 个 Creator 工作流 Skill、1 个 CLI Skill 与 Creator 2.4.x 参考资料纳入 CLI 发布包。`skill show/list/install/refresh` 提供查看、选择性部署、用户/项目作用域安装、内容漂移检查及覆盖备份。多项安装先整体预检，遇到未管理/手改内容时不做部分安装。
- `plugins/cocos-creator-agent/` 已收缩为旧插件安装场景的 CLI bootstrap Skill；Codex/Claude 插件配置不再启动它自己的 MCP server。

## 验收回执

- CLI 自动化测试：`npm test` 通过 **26/26**，包括 CLI 入口启动 MCP stdio server、工具发现及本机 loopback 桥接调用；MCP configure 冲突/幂等/dry-run；Skill 用户路径安装、相对参考资料、漂移拒绝和强制备份。
- npm tarball：`cocos-creator-agent-cli@0.8.0`，87 个文件，包括 52 个 `SKILL.md`、13 个参考 Markdown 文件、MCP server/configure 模块。SHA-256：`88a6a88bdb11825da573211e2c98e3861255db06bce8fef32a0a625f34fc5484`。
- 将该 tarball 安装到隔离 npm prefix，安装后的 CLI 返回 0.8.0；从已安装包运行 `skill install codex`，结果为 52 个 Skill 目录及参考资料目录全部安装成功，`references/2x/README.md` 的相对路径有效。
- 使用真实 Codex CLI 和独立 `CODEX_HOME` 临时目录执行 `mcp configure --dry-run`、`configure`、`status`、`remove`，依次返回 `would-configure`、`configured`、`configured`、`removed`。注册命令指向该 tarball 安装目录的 CLI `mcp serve`。
- 使用真实 Claude Code CLI 和隔离 `HOME` 执行用户级 `configure`、`status`、`remove`，依次返回 `configured`、`configured`、`removed`，配置文件仅生成在临时 HOME。

## 未验收项

- 没有重启当前 Codex 或 Claude Code 桌面 Host，也没有验证真实 Host 会话中的新 MCP 工具目录；这是 Host UI/会话验收，不由原生客户端 CLI 配置回执替代。
- 没有连接 Creator 2.4.15 实例或执行 Creator 命令。本记录不证明 Creator 工程扩展、写入、预览或运行时能力已通过。
- CLI 0.8.0 尚未公开发布 GitHub Release；本次 tarball 与 SHA-256 是本机临时打包结果。
