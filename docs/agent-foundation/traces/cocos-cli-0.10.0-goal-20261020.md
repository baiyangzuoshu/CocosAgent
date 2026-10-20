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

## 2026-10-20 实机验收续记：Provider、预览和 CLI 0.10.4

- Dashboard 再次确认 `tank`（父目录 `/Users/youjunmao/WORK/Cocos_Engine`，项目根 `/Users/youjunmao/WORK/Cocos_Engine/tank`）、Creator 2.4.15、状态“已打开”。精确绑定 2.4.15 应用后，Creator 窗口为 `Cocos Creator - tank - db://assets/CocosCliAcceptance20261020.fire`；扩展 0.6.2，命令合同 SHA-256 `e4efd9a1ad472fa74b233159ba6fc811626d35f8268a7a193d326910e76cfa47`。
- 临时项目 Provider 在加载后由 CLI 与 MCP 发现；Provider 只读命令回读成功，审批写入成功并回读新值，取消审批的写入被拒绝且状态未改变。此处保留运行时操作回执；临时 Provider 与样本资产尚待基线恢复。
- CLI 0.10.3 首次启动预览成功：Creator 原生批准，实例 `d6c3577e-a25c-41be-a2c9-ba2d3ca83236`、场景 `CocosCliAcceptance20261020`、UUID `33114787-cbbd-44e4-b9be-1d8c470bf4fa`；预览地址 `127.0.0.1:7456`。CLI 读回场景身份与运行页一致，初始截图显示 `Ready: 0`，截图 SHA-256 `8aba361fd05fbd97150ed92d31e4dfc7503cdd45d4e69ab1923e55fd19ebb0a5`。
- 首次运行输入/断言发现两个真实缺口：Creator 2.4 的 `Node.getComponents()` 不支持无参调用，组件断言因此产生 Console 错误；键盘动作在后台 Agent 浏览器页没有送达。已修复组件字段读取为 2.4 兼容的 `_components` 检查，并在交互前通过 CDP `Page.bringToFront` 激活预览页，增加两个组件读取单测。
- 用 Creator 默认预览页人工点画布并发送空格，画面显示 `Count: 1`，证明临时脚本和输入业务逻辑正常；这不是 CLI 同会话输入验收。
- 本地 CLI 0.10.4 包含预览组件断言和输入置前修复，`npm test` **52/52 通过**；tarball 97 文件、172,057 字节，SHA-256 `92ef4320726385f989ae100c70b0688494681329a8583b48f22e40bbf066f898`。安装后的全局 CLI 报告 `0.10.4`，桥接 ID `8b8cbfe4-0359-44e8-8609-84e477286bd1`，合同指纹与 Creator 2.4.15 扩展匹配。
- CLI 0.10.4 MCP stdio 的 `initialize` / `tools/list` 返回成功，协议 `2024-11-05`，server 版本 `0.10.4`，静态目录 36 项。因最终复验时 Creator 实例已失联，此次没有 Provider 动态工具；上一版 CLI 0.10.2 的 Provider MCP 读/审批写曾实机成功，最终版 Provider 调用待 Creator 恢复后复验。
- CLI 0.10.4 检查真实用户级 Host 配置：Codex、Claude Code 均为 `configured`；`skill list` 两端各 52 项且状态全为 `installed`。这证明配置指向已升级的独立 CLI/Skills，不代表桌面 Host 本轮重载了新的 MCP 工具目录。
- 独立临时 Creator 项目生命周期：CLI 安装 `0.6.2` 后 `status` 显示 managed、无 drift；把受管理样本版本设为 `0.6.1` 后正常更新到 `0.6.2`；在 `main.js` 注入 drift 后，默认更新以 `EXTENSION_LOCAL_CHANGES:main.js` 拒绝；`--force` 更新成功并生成备份 `/Users/youjunmao/.cocos-creator-agent/extension-backups/96f4b12e9a496267/1792508215992-0.6.2-59059d51`，已读回确认备份保留 drift 原文；随后卸载成功、status 报 `installed:false`，临时项目已清理。这个生命周期项目未在 Creator UI 加载，不能替代实机重载验收。
- 用 CLI 0.10.4 再次执行 `self-update --check --version 0.9.0`，仍退出 2，返回 `CLI_RELEASE_HTTP_404`；线上 Release tarball、SHA-256、自更新与回滚仍不能验收。
- **待继续的实机检查：** 最终 CLI 0.10.4 的预览批准窗口出现时 Mac 已锁定；按 Ctrl-C 取消等待中的启动，没有绕过锁屏。锁屏前的 0.10.3 输入断言为 `counter=0`（未通过），0.10.4 修复尚未运行到实时断言；锁屏后 `doctor` 观察到 0 个连接的 Creator 实例。解锁后重新核对 Dashboard/Creator/扩展身份，再启动预览，用同一 session 验证 `counter=1` 与无新 Console 错误，并恢复临时 Provider 与场景/脚本基线。
- GitHub 0.9.0 Release 资产、自更新与回滚仍因远端 API 404/凭据不可用而未验收；本地 tarball 不代表公开发布。本记录已随 `e9191c8` 提交；后续新增的 Creator 临时验收文件和 `.DS_Store` 变更未提交。

## 2026-10-20 后续续验：桥接恢复与 Provider 阻塞

- 再次确认系统锁屏状态；原生应用清单不可用。Creator Agent MCP 与 CLI 的实例列表均返回 `instances: []`、`rejectedInstances: []`。不能在当前状态重载临时 Provider、批准预览或恢复场景。
- 用户授权继续后，通过提升权限的 CLI 恢复本机桥接：bridge ID `8b8cbfe4-0359-44e8-8609-84e477286bd1`，loopback `127.0.0.1`；提升权限的 `doctor --project-root .../tank` 显示合同/协议匹配，CLI 0.10.4、扩展 0.6.2、指纹 `e4efd9a1ad472fa74b233159ba6fc811626d35f8268a7a193d326910e76cfa47`，7 项通过、1 项项目实例警告、0 项错误。Creator 实例仍为 0。
- 默认沙箱下对用户级桥接目录的访问返回 `EPERM`；提升权限调用只用于恢复桥接及读取诊断/实例状态。桥接健康不等于 Creator 已连接，也不等于 Provider 已加载。
- `creator test --project-root .../tank --list` 返回 `ENOENT`，因为该工程没有 `.cocos-agent` 测试计划；不创建测试配置来掩盖本轮 Provider 实机验收的缺口。
- 运行时验收样本仍在磁盘：`assets/CocosCliAcceptance20261020.ts/.meta`、`assets/CocosCliAcceptance20261020.fire/.meta` 及 `packages/cocos-cli-acceptance-provider/`。本轮未改写这些样本；Creator 连接恢复后应先完成最终版 0.10.4 同 session 预览输入/断言，再通过 Creator AssetDB/UI 恢复基线并核对只剩预期扩展安装文件。
- 本次在线 GitHub Release 页面读取也返回 cache-miss；没有新增线上发布或更新证据。发布资产、自更新/回滚和 Creator 实机验收继续标为未完成。

## 2026-10-20 离线推进：VCS 完整性诊断

- CLI 源码版本升至 0.10.5，新增只读 `vcs doctor --git-root <绝对路径> --project-root <绝对路径>`。显式校验 Git 仓库根与其内 Creator 工程路径，扫描 Git 跟踪的 Creator 缓存/构建目录、`assets/` 文件和目录的 `.meta` 配对、JSON metadata 主/子资源 UUID 重复，以及有成对起止符的文本冲突标记。扫描不跟随符号链接，报告文件/总大小上限和跳过情况，不运行 `git add` 或写工程文件。
- 临时 Git 仓库覆盖干净结果、缺失/孤立 `.meta`、重复 UUID、跟踪缓存、冲突标记、Git/project root 校验；测试前后核对 Git index 哈希、`git status` 和所有样本哈希，均未变化。新增 CLI JSON 路由测试。
- `npm test` 默认沙箱下 52 项通过、3 项本机回环集成测试因 `listen EPERM` 失败；按审批提升权限重跑后 **55/55 通过**。最终 0.10.5 tarball 为 98 个文件、175,292 字节，SHA-256 `7213acaca6fee9d017a2d101a1010aa5f56c8435e2bb11f1888597c93e382263`，确认包含 `vcs-integrity.mjs`；隔离安装后的 0.10.5 在临时干净 Git/Creator 工程上返回 `ok: true`、0 findings。这是源码/临时夹具证据，不是 Creator AssetDB 验收。全局 CLI 仍为 0.10.4，未发布或升级全局安装。
- VCS/模板/资源包评估文档已更新：场景/Prefab 语义差异、模板、资源包仍在计划中；无自动场景合并。
