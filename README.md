# Cocos Creator Agent CLI

`cocos-creator-agent` 是独立的 Cocos Creator Agent 命令行工具：可以直接在终端使用，也可以连接 Codex、Claude Code、Cursor、VS Code 或 DeepSeek Harness。它提供 MCP 工具、Creator 工作流 Skills 和项目扩展管理；不需要另装一个 Host 插件。

当前编辑器连接与项目操作支持 **Cocos Creator 2.4.1–2.4.16**。启动新编辑器或执行构建/编译时，自动按 2.4.16、2.4.15、2.4.14……2.4.1 的顺序优先使用已安装版本中最高的补丁版；已打开的受支持实例会复用，传入 `--creator` 时使用指定安装。Creator 3.8 不在当前支持范围内。实机验收证据目前仍以 2.4.15 为准。

## 环境要求

- Node.js 20 或更高版本。
- 要使用编辑器连接能力，准备一个 Creator 2.4.1–2.4.16 工程和对应版本的编辑器。CLI 的 Creator 编辑器发现与启动支持 macOS、Windows。
- Codex、Claude Code 等 Agent Host 是可选的；不使用 Host 时仍可直接运行 CLI 命令。

## 安装

CLI 当前发布版本为 `1.0.0`，通过 GitHub Release 分发，不从 npm 公共 registry 安装。

### macOS / Linux 终端

```sh
VERSION="1.0.0"
npm install --global "https://github.com/baiyangzuoshu/CocosAgent/releases/download/cocos-creator-agent-cli-v${VERSION}/cocos-creator-agent-cli-v${VERSION}.tgz"
```

### Windows PowerShell

```powershell
$Version = "1.0.0"
npm install --global "https://github.com/baiyangzuoshu/CocosAgent/releases/download/cocos-creator-agent-cli-v$Version/cocos-creator-agent-cli-v$Version.tgz"
```

确认安装：

```sh
cocos-creator-agent version --format json
cocos-creator-agent --help
```

检查更新或安装最新发布版：

```sh
cocos-creator-agent self-update --check
cocos-creator-agent self-update
```

## 连接 Agent Host

以 Codex 为例，先预览将要安装的 Skills 和 MCP 配置，再执行安装：

```sh
cocos-creator-agent skill install codex --dry-run
cocos-creator-agent skill install codex
cocos-creator-agent mcp configure codex --dry-run
cocos-creator-agent mcp configure codex
```

配置完成后重启 Codex。使用 Claude Code 时，把上述两个命令里的 `codex` 换成 `claude-code`。MCP 配置还支持 `cursor`、`vscode` 和 `deepseek-harness`；CLI 的 Creator Skills 安装器支持 Codex、Claude Code 和 DeepSeek Harness。

不使用 Host 时可直接查看能力目录或 CLI 命令：

```sh
cocos-creator-agent catalog --format json
cocos-creator-agent help
```

## 连接 Creator 工程

每次准备打开或切换工程前，先在 Cocos Dashboard 核对工程名称、绝对路径、Creator 版本和打开状态。将 CLI 扩展安装到目标工程后，如果工程已经打开，请在 Creator 中重新加载；如果工程尚未打开，可用 `project open` 启动它：

```sh
cocos-creator-agent extension install --project-root "/absolute/path/to/project"
cocos-creator-agent project open --project-root "/absolute/path/to/project"
cocos-creator-agent instances list
cocos-creator-agent doctor --project-root "/absolute/path/to/project"
```

`instances list` 用于确认已连接的编辑器实例；后续命令应使用它返回的准确 `instanceId`。`doctor` 只做诊断，不会启动已停止的 bridge。

会修改工程或控制编辑器的操作，需要你明确执行对应的 commit 命令；Creator 不会再弹出确认框。执行前请核对工程身份和操作计划。

## 更多文档

- [CLI 完整手册](cocos-creator-agent-cli/README.md)：命令、MCP 配置、Skills、项目扩展和更新说明。
- [第三方接入说明](plugins/cocos-creator-agent/README.md)：兼容引导与 Host 接入流程。
