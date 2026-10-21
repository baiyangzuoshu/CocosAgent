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

## 2026-10-20 私有 Release 鉴权与 0.10.6

- 当前 GitHub 连接列出的 `baiyangzuoshu/CocosAgent` 为私有仓库（仓库 ID `1316650401`）。连接器的通用读取 API 对仓库、release tag 和 commit 返回 404；该接口仅支持公开仓库，不能据此断言 0.9.0 Release 不存在。SSH 远端查询当前失败于 DNS（`Could not resolve host: github.com`）；机器无 `gh` 命令，`GH_TOKEN` 与 `GITHUB_TOKEN` 环境变量均未设置，因此本机暂时没有可用的私有仓库读取凭据。
- 发现 updater 原先只访问未认证 GitHub API/公开下载 URL，私有 Release 即使存在也无法由独立 CLI 下载。源码版本升至 0.10.6：更新器优先读取 `GH_TOKEN`/`GITHUB_TOKEN`，否则尝试 `gh auth token --hostname github.com`；令牌只随 API 请求发往 `api.github.com`，优先用 Release Asset API 获取私有文件，交给 npm 安装前从子进程环境剔除两种令牌。校验和不匹配继续拒绝安装。
- 新增私有 Release 检查、0.9.0 降级安装、校验和错误拒绝、GitHub CLI 令牌回退及 npm 子进程令牌隔离测试。完整 CLI 测试 **59/59 通过**。
- 0.10.6 tarball 为 98 个文件、176,068 字节，SHA-256 `79777beb755b69fbb66cc1fc648640e39b29a915765468507138c9da6261db75`。在隔离 prefix 安装后，版本命令返回 `0.10.6`，帮助列出 `self-update` 与 `vcs doctor`。这是本地发布包验收，不是 GitHub Release 或线上更新验收。
- **线上 0.9.0 Release、资产下载、自更新与回滚仍未验证。** 当前可证明的是目标仓库为私有且当前环境无可用 CLI 凭据/网络；此前未认证 HTTP 404 不能作为 Release 不存在的证据。需从有仓库访问权且网络可用的 Host 执行实际线上验收。

## 2026-10-20 全局 CLI 与 Host MCP 续验

- 将本机全局 CLI 从 0.10.4 更新到本地验收包 0.10.6；`cocos-creator-agent version --format json` 与 Codex Cocos CLI 状态工具均返回 0.10.6 / Creator 2.4.15。0.10.4 回滚包仍保留在 `/private/tmp/cocos-cli-acceptance-20261020/cocos-creator-agent-cli-0.10.4.tgz`。
- 对全局安装的 `cocos-creator-agent mcp serve` 执行真实 stdio JSON-RPC `initialize` 和 `tools/list`：serverInfo 为 `cocos-creator-agent` 0.10.6，协议 `2024-11-05`，返回 36 个工具。此验证的是 CLI 子进程自身的工具目录。
- `mcp status codex` 和 `mcp status claude-code` 均为 `configured`；两个 Host 的 Skill 清单分别为 52/52 `installed`。这只证明配置文件与 Skill 安装状态，桌面 Host 尚未重启确认加载后的会话目录。
- Creator Agent MCP 与 CLI 的实例列表均为空（`instances: []`，`rejectedInstances: []`）。本机桥接 `doctor` 上次已显示健康、合同匹配，但 Creator 当前未连接；Provider 重载、审批写入、恢复和最终版预览同会话断言仍未完成。系统锁屏阻止本轮在 Creator UI 中加载临时 Provider。
- 全局 CLI 0.10.6 与 CLI-owned MCP 已验收；私有 GitHub Release 线上下载/自更新/回滚仍受仓库凭据与网络限制。以上两项不替代 Creator 实机验收，也不改变整体目标未完成状态。

## 2026-10-20 CLI 测试与在线 Release 复核

- 在当前源码 0.10.6 上重新运行 `npm test`：默认沙箱 56/59；3 项本机回环桥接集成测试因 `listen EPERM` 失败。按测试范围提升权限重跑后 **59/59 通过**。覆盖项目 Node 测试子进程、JSON/JUnit、Creator Provider/预览适配、目录/受影响套件 watch、取消/恢复、构建合同与 VCS 只读检查。这些是 CLI 实现测试，不是 Creator 实机运行。
- 再次读取私有仓库 Release API `/repos/baiyangzuoshu/CocosAgent/releases/tags/cocos-creator-agent-cli-v0.9.0` 返回 404；SSH `git ls-remote` 仍因 `Could not resolve host: github.com` 失败。私有仓库的未授权 404 不能证明 Release 不存在，线上资产、SHA-256、自更新和回滚继续未验收。
- 系统仍锁屏，Creator Agent MCP/CLI 实例列表为空；本轮无法从 Creator 加载 Provider 或做审批写入与预览运行。整体目标继续保持未完成。

## 2026-10-21 续验：桥接、CLI 测试与当前实机入口

- 按用户要求运行 `/usr/bin/caffeinate -dimsu -t 28800`。`pmset -g assertions` 确认 PID `15714` 同时持有 `PreventUserIdleDisplaySleep`、`PreventUserIdleSystemSleep`、`PreventSystemSleep`，超时为 28,800 秒；这是本机临时状态，不代表项目验收。
- 全局 CLI 状态为 `0.10.6`，Creator 目标版本 `2.4.15`；捆绑扩展 `0.6.2`，30 条 Creator 命令，合同 SHA-256 `e4efd9a1ad472fa74b233159ba6fc811626d35f8268a7a193d326910e76cfa47`。
- 普通沙箱内 `doctor` 的 loopback 请求返回 `fetch failed`；通过允许本机 loopback 的调用复核，桥接 ID `485a7d1b-7b6b-4f1b-b30a-009f3c524534` 健康，Creator/协议/扩展版本与合同指纹匹配。提升权限 `doctor` 为 6 项通过、0 警告、0 错误，但发现 `0` 个连接的 Creator 实例。普通沙箱的错误是回环网络访问限制，不是桥接故障。
- 在 `tools/cocos-creator-agent-cli/` 运行完整 `npm test`，结果 **59/59 通过**。这是 CLI 自动测试，不替代 Creator 实机结果。
- 当前 Cocos Dashboard 2.2.2 截图显示“安装”页及 Creator `3.8.7`、`2.4.15` 安装路径，没有显示项目列表。Dashboard 无障碍树只暴露窗口标题栏；项目页点击操作两次返回 `noWindowsAvailable`。因此本轮不能核实项目名、项目绝对路径、版本与打开状态；未调用实例发现或任何项目工具，也未触碰 `tank` 工程。
- 私有仓库 Release 复核仍未能取得权威结果：GitHub 连接器的已安装仓库检索返回空列表，Release API 返回 404；本机 `git ls-remote` 报 `could not read Username for 'https://github.com'`。这些结果不能证明 Release 不存在，也没有新增线上资产、自更新或回滚证据。
- 本轮没有提交代码；测试与只读诊断没有更改既有工作区。当前工作区已有的 `.DS_Store`、`tank` 扩展安装差异、临时验收 Provider 和资产仍保留，需在目标 Creator 会话恢复后按 AssetDB/基线流程处理。
- 下一步先恢复可操作的 Cocos Dashboard 项目列表与 Creator 2.4.15 实例连接，再核对 `tank` 完整工程身份；然后按既有 Provider/同会话预览验收记录完成读/审批写/取消/输入断言和基线恢复。私有 Release 自更新还需一个可访问该仓库的认证 Host。

## 2026-10-21 续验：Provider 写入与运行时输入闭环

- 再次核对 Cocos Dashboard 注册项与 Creator 窗口：项目 `tank`，项目根 `/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 2.4.15，扩展 0.6.2；当前场景 `CocosCliAcceptance20261020`，UUID `33114787-cbbd-44e4-b9be-1d8c470bf4fa`。CLI 与 Creator 实例 ID `d6c3577e-a25c-41be-a2c9-ba2d3ca83236` 报告路径、版本和场景一致。
- 临时 Provider CLI 读命令返回基线值 0。经 Creator 原生审批，CLI 写入 37 并读回；取消将值改为 99 的审批后返回 `EXTENSION_COMMAND_NOT_APPROVED`，读回仍为 37。经 CLI-owned MCP stdio `tools/list` 动态发现 Provider 工具并 `tools/call` 写入 64，回执包含 `approvalSource: creator-native-dialog`、前值 37 和新值 64；CLI 与真实 MCP stdio 的只读回执一致。随后经原生审批写回 0，CLI 读回确认恢复。Provider 指纹 `8c8209b9f01a24339bd9724b7a587270066139ef987d2154992308ca432c6356`，目录哈希 `a167a41a13a636186f490492feeaed8dcdefdd631a1c2bb0d7ad9655bdd15f8f`。
- CLI 0.10.6 原有预览键盘实现只发送 `key` / `code`，真实 Creator 2.4.15 同会话输入 Space 未触发 `counter`（断言为 0，截图显示 `Ready: 0`）。按 Chrome DevTools Protocol，`windowsVirtualKeyCode` 默认值为 0；此行为与 Creator 依赖键码的系统键盘事件不匹配。[CDP `Input.dispatchKeyEvent` 参考](https://chromedevtools.github.io/devtools-protocol/tot/Input/)。
- 修改 `tools/cocos-creator-agent-cli/bridge/runtime-preview.mjs`，为允许的方向键、Space/Enter/Escape/Tab、字母和数字补上 Windows 虚拟键码；用工作区 CLI 源码重启本机桥接（ID `0537d63e-ba83-4a4e-91d3-8ab70b060f06`，`127.0.0.1:51873`），未更改 tank 资产。新预览会话 `a8878930-ede4-4f85-8536-20f50bf755a6` 在同一实例/场景中执行画布点击与一次 Space 输入，MCP 回执断言 `counter === 1`、`no-errors` 均通过；截图 `/Users/youjunmao/.cocos-creator-agent/captures/a8878930-ede4-4f85-8536-20f50bf755a6/capture-1792538111908-586ada.png`，SHA-256 `b67576b394e13f659906ed1dab80a97633c86341693611c982ff86877b16d02e`，画面可见 `Count: 1`。预览已关闭；Creator 预览服务器仍由 Creator 管理。
- 本轮首次构造断言时，命令合同暴露的通用 `name` 字段被 `no-errors` / `component-property` 运行时校验拒绝 (`PREVIEW_ASSERTION_FIELD_INVALID`)。删除该可选字段后真实断言通过；合同中按断言类型收敛字段的工作仍待处理。一次通过 Creator Agent MCP 包装调用的重启请求还短暂返回 `BRIDGE_ROUTE_NOT_FOUND`；独立 CLI 启动和后续源代码桥接下的 MCP 交互均成功，此瞬时路由问题尚未定位。
- `tools/cocos-creator-agent-cli/` 完整 `npm test`：默认沙箱 56/59，3 项只绑定 `127.0.0.1` 的桥接集成用例因 `listen EPERM` 失败；在允许本地回环监听的测试环境重跑后 **59/59 通过**。这是 CLI 自动测试加上一条真实 Creator/MCP 运行证据，不代表发行安装包已包含本轮源码补丁。
- 临时 Provider 包及 `CocosCliAcceptance20261020` 样例场景/脚本仍在 tank；本轮 Provider 内存值已恢复 0，预览会话已停止，没有删除或改写资产。恢复整个项目基线尚未完成。当前工作区未提交。
- 用户再次要求屏幕 8 小时不熄；启动新的 `caffeinate -dimsu -t 28800`。`pmset -g assertions` 记录 PID `19452` 的 `PreventUserIdleDisplaySleep`、`PreventUserIdleSystemSleep` 和 `PreventSystemSleep` 断言剩余约 28,796 秒；旧断言未终止。
- GitHub 私有 Release 在线资产与更新仍无认证可读证据；0.10.6 Release、自更新和回滚仍未验收，整体目标继续未完成。

## 2026-10-21 发布候选核查

- `pmset -g assertions` 于 07:19 显示 PID `19452` 仍持有 `PreventUserIdleDisplaySleep`、`PreventUserIdleSystemSleep` 和 `PreventSystemSleep`，距 8 小时超时约 27,950 秒；没有终止旧 `caffeinate` 断言。
- 使用已登录 GitHub 浏览器检查私有仓库：主分支最新提交 `31369215b5582e26f3a941897389f80a617ce47e` 与本地 `origin/main` 一致。仓库 Releases 列表显示无已发布 Release；标签列表只有 `cocos-creator-agent-cli-v0.9.0`，其页面提供“Create release from tag”，并仅有 GitHub 自动生成的 Source code zip/tar.gz，没有 CLI 包和校验和资产。因此线上分发、自更新和回滚仍未验收；旧 API 404 不能代表标签或 Release 状态。
- 在隔离 npm 缓存与 prefix 下执行 `npm pack`、安装打包文件并调用 CLI：候选包版本 `0.10.6`，Creator 目标 `2.4.15`，tarball 98 个文件、176,237 字节，SHA-256 `034ffe4d373837555362ac1d0e2c7e6bdc23b7267506b5711f4380995777d34c`；隔离安装后版本命令返回 `0.10.6`，包内 `bridge/runtime-preview.mjs` 含 `windowsVirtualKeyCode` 修复。该本地产物不是 GitHub Release。
- 默认 npm 缓存因 root-owned 文件报 `EPERM`；通过 `/private/tmp/cocos-cli-npm-cache` 完成打包和隔离安装，没有改动用户全局 npm 缓存权限。终端 `git ls-remote` 因当前网络 DNS 无法解析 `github.com` 失败；浏览器只读确认可用，但尚未进行远端写入。
- 发布前仍需把 CLI 键盘输入修复和本验收记录提交到仓库，按现有 Release workflow 推送 `cocos-creator-agent-cli-v0.10.6` 标签，等待 CI 创建 tarball/SHA-256 资产后再用已安装 CLI 实际验证自更新和回滚。工作区其他 `.DS_Store` 与 `tank` 验收文件不应纳入该提交。

## 2026-10-21 0.10.6 发布尝试

- 以中文提交 `3d4872c16f8c2cab39ba807e14534eb49de47e0d` 推送 CLI 键盘输入修复及前述实机验收记录；随后推送标签 `cocos-creator-agent-cli-v0.10.6`。该提交只含 CLI 运行时文件和此记录，`tank` 的未提交验收改动未纳入。
- 已登录 GitHub Actions 页面显示“workflows can't be executed”，原因是账户 billing locked；发布工作流显示 0 次运行。标签已存在，但此状态下 CI 不会生成 Release。
- 在隔离 npm prefix 中安装 `0.10.6` 候选包成功，CLI 版本输出为 `0.10.6`，包内包含键盘虚拟键码修复。已准备本地资产 `cocos-creator-agent-cli-v0.10.6.tgz` 与 `.tgz.sha256`；tarball SHA-256 为 `034ffe4d373837555362ac1d0e2c7e6bdc23b7267506b5711f4380995777d34c`。
- 尝试在已登录 GitHub Release 表单手工附加资产；Chrome 文件选择器 10 秒内未产生选择事件，未上传文件，也没有提交 Release 表单。按浏览器上传排障要求，需要在 ChatGPT Chrome 扩展详情中启用 `Allow access to file URLs`；这是扩展访问本机文件的权限，当前未擅自变更。Release、自更新与回滚仍未验收。
- 若继续人工发布，需先处理 GitHub billing lock 以恢复 Actions；若采用手动发布，再启用上述 Chrome 文件 URL 权限后，把本地 `.tgz` 和校验和文件附加至现有 0.10.6 标签的 Release，核对线上资产及哈希，再测试安装、更新与回滚。

## 2026-10-21 续验：0.10.6 候选包与 Creator 同会话运行

- Cocos Dashboard、Creator 2.4.15 窗口与扩展/CLI 回执一致：项目 `tank`，工程根 `/Users/youjunmao/WORK/Cocos_Engine/tank`，实例 `d6c3577e-a25c-41be-a2c9-ba2d3ca83236`，扩展 `0.6.2`，活动场景 `CocosCliAcceptance20261020`（UUID `33114787-cbbd-44e4-b9be-1d8c470bf4fa`）。
- CLI 0.10.6 `doctor` 9/9 通过、0 警告、0 错误；Creator 命令合同指纹 `e4efd9a1ad472fa74b233159ba6fc811626d35f8268a7a193d326910e76cfa47`，捆绑与项目扩展均为 0.6.2，30/30 Creator 固定命令可用。
- 在隔离 prefix 安装候选 tarball 后，通过候选 CLI 对 Creator 实例启动真实预览；Creator 原生审批通过，预览 session `1b2e9c2e-678a-4314-9b1d-9c63c027b476`。Creator AssetDB 搜索和 `script read` 由扩展回执读取 `CocosCliAcceptance20261020.ts`，源码 SHA-256 `229b708ba5aff1dae7d0e52b3bf40ba3c347d67d36b19007674d757464a50f6e`，`.meta` SHA-256 `b2baa9854cff897d29f48592b15f2e6dd957add8f5401363d33aae17bb1ad3ab`。
- 仅发送 Space 时计数仍为 0，确认预览画布尚未聚焦；在同一 session 先点击画布，再发送 Space，CLI 声明式断言 `counter === 1` 与 `no-errors` 均通过。截图 `/Users/youjunmao/.cocos-creator-agent/captures/1b2e9c2e-678a-4314-9b1d-9c63c027b476/capture-1792539661897-a2f529.png`，SHA-256 `6d63ec6bd9219f4ff87247835a4b0d10d958eebde8b046d8635081126b7e4658`，可见 `Count: 1`。测试后停止 Agent 预览 session；Creator 自身预览服务仍由 Creator 管理。
- 同一候选 CLI 作为 MCP stdio server 的 `initialize` 成功，协议 `2024-11-05`，server `0.10.6`；`tools/list` 返回 38 项（包含在线 Provider 工具），`cocos_project_info` 实际调用返回同一 `tank` 工程、Creator 版本、扩展版本和场景身份。全局安装的 CLI 仍报告 0.10.6；Codex 与 Claude Code `mcp status` 均为 `configured`，Skill 清单均已安装。Host 配置回执不等于桌面会话已重载工具目录。
- 候选 tarball `/private/tmp/cocos-cli-release-candidate/cocos-creator-agent-cli-v0.10.6.tgz` 为 98 文件、176,237 字节；SHA-256 `034ffe4d373837555362ac1d0e2c7e6bdc23b7267506b5711f4380995777d34c`，配套 `.sha256` 文件与该值一致。候选包安装、MCP 调用和 Creator 同会话预览通过；这些结果仍不证明线上 Release 或 `self-update` 已通过。
- CLI 测试此前已按本机回环权限范围重跑，59/59 通过。全局 MCP 当前固定目录为 36 项；候选 CLI 在线 Creator/Provider 实例存在时返回 38 项，目录数不同来自动态 Provider 工具，不视为合同漂移。
- 线上发布仍阻塞：GitHub Actions 因账户 billing locked 未执行；当前环境 `gh` 命令不存在。Chrome 浏览器安全策略拒绝导航到 `chrome://extensions`，明确禁止通过其他界面、命令、CDP 或浏览器表面绕过。用户已明确授权启用文件 URL 权限，但工具策略不允许执行这项被拒绝的权限操作；未上传 tarball、未创建 Release、未尝试改变权限。GitHub Release 上传、SHA-256 远端核对、线上自更新和回滚继续未验收。
- 本轮未修改 tank 源码/场景，预览已停止；此前创建的 Provider 包和验收场景/脚本仍是工作区未提交内容，尚未恢复整个 tank 基线。需单独按 Creator AssetDB/UI 流程恢复，不能直接删除磁盘样本替代编辑器回执。

## 2026-10-21 续验：脚本创建/编译与场景节点写入

- 仍在已核对的 Creator 2.4.15 `tank` 实例（`d6c3577e-a25c-41be-a2c9-ba2d3ca83236`）上操作。通过 `creator.script.create.plan/commit` 创建临时脚本 `db://assets/CodexAcceptanceTemp20261021.ts`；Creator AssetDB UUID `2bab3a89-37d9-4335-a583-09f4169ed3e6`，源码 SHA-256 `b5010d54398cda96970e3fc4a3ec289070a2c61a3e377ea6a7d0e268346d48b4`，`.meta` SHA-256 `8592bf4571fe9a2cb389b470742ae3ef22e2e3b917cb0579285b34ec55dc5f5b`。`creator.script.read` 从同一 Creator AssetDB 回读源码和 UUID/哈希一致。
- 对 Creator 2.4.15 执行 Web-Mobile debug build，输出在工程外 `/private/tmp/cocos-cli-script-create-build-20261021`。Creator Builder 日志到达 `build-finished`，CLI 最终退出码 0、`success: true`、未超时；输出 13 个文件，生成 JS 中能找到新脚本模块与装饰器注册。进程 stderr 另有弃用提示与 `Load profile failed: local://settings.json`，因此只记录构建命令成功和产物代码证据，不声称无警告。构建产物未放入 tank。
- 场景写入测试目标为 `CocosCliAcceptance20261020/Canvas`（场景 UUID `33114787-cbbd-44e4-b9be-1d8c470bf4fa`，节点 UUID `fajmfI4k5PkbS2JhUsJP0d`）：操作 `19dcbbd8-5500-4b00-bf15-299e49ef29c9` 经 Creator 原生批准，把 active 从 true 改为 false；随后操作 `1c3c5fc8-8fb0-4bb6-91ac-b87a00e9f069` 经批准改回 true。两次写入均从同一 Creator 场景会话回读成功并请求保存，但 Creator 2.4 的保存 IPC 不返回完成确认，不能当作磁盘持久化证明。
- 前态冲突验证：在 Canvas=false 时生成的过期计划 `52701015-9ea1-47d5-a439-797efc19cc34`，待另一计划已将 Canvas 恢复 true 后提交，命令返回 `OPERATION_PRECONDITION_FAILED`；reconcile 将其标记 `conflict`，无保存请求，观察状态 true。审批取消验证：计划 `938f2b30-505b-42b2-aa81-a41e27ea8aaf` 由 Agent 发起后在 Creator 原生框点 `Cancel`，工具返回 `OPERATION_NOT_APPROVED`，reconcile 标记 `cancelled`；最终 `creator.scene.snapshot` 回读 Canvas active=true。场景的内存状态回到本轮操作前值。
- 按用户对指定临时脚本的操作时确认，在 Creator 资源管理器中删除 `db://assets/CodexAcceptanceTemp20261021.ts`；Creator AssetDB 搜索和 `creator.project.search` 随后均返回 0 条匹配。该条目的原 UUID 与源码/`.meta` SHA-256 已于删除前从 Creator 工具回执复核。
- 按用户对明确列出的两个临时资源给出的授权，在 Creator 资源管理器中删除 `CocosCliAcceptance20261020.fire` 与 `CocosCliAcceptance20261020.ts`。删除过程中 Creator Console 曾显示 `[db-task][delete] Failed to load meta .../assets/CocosCliAcceptance20261020.fire.meta ... ENOENT`；这是编辑器 UI 中观察到的删除警告。随后 Creator AssetDB 和 `creator.project.search` 均对 `CocosCliAcceptance20261020`、`CodexAcceptanceTemp20261021` 返回 0 条。关闭并从 Dashboard 重新打开 `tank` 后，Creator 实例 `b1ac0426-e142-4449-9189-f4e8287620bd` 报告工程根 `/Users/youjunmao/WORK/Cocos_Engine/tank`、版本 2.4.15、扩展 0.6.2，活动场景为干净的 `New Node`（UUID `cfo6q9UJNL45fn3+Fw6SM9`）；场景快照只有默认根节点、Canvas 与 Main Camera，没有旧场景或 `cc_MissingScript`。重启后的 diagnostics 序列为 0、事件为空；因此只能记录编辑器 UI 曾出现删除警告，不能把它归为当前残留错误。
- 临时 Provider 目录从 `tank/packages/cocos-cli-acceptance-provider/` 移至可恢复备份 `/private/tmp/cocos-cli-acceptance-provider-20261021`，没有删除备份。重启后 `creator.project.tools.list` 返回 `status: not-configured`、空工具目录，证明该 Provider 未被重新发现。构建后 diagnostics 在删除确认框等待期间曾超时，未取得该时点的 Console 回执。
- GitHub Release 上传/线上自更新与回滚状态未变；GitHub Actions 仍受 billing lock 阻塞，Chrome 不允许通过其他入口绕过文件 URL 权限限制。本轮修改仅为本追踪文档；tank 内尚有此前验收改动，不纳入仓库暂存区。

## 2026-10-21 续验：CLI 0.11.0 脚本修改闭环与扩展生命周期

- 按仓库工作路由重新核对 Cocos Dashboard 与 Creator：Dashboard 的 `tank` 条目显示项目目录 `/Users/youjunmao/WORK/Cocos_Engine`，项目名 `tank`；Creator 扩展实时回报完整根路径 `/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 2.4.15，扩展 0.6.2，活动场景 `New Node`（UUID `cfo6q9UJNL45fn3+Fw6SM9`）。项目身份一致。Creator AssetDB 空查询返回 `total: 0`；本轮没有在 `tank` 创建或修改资产。
- 通用 Editor 扩展命令发现/调用已存在于共享合同：`creator.extension.commands.list` 与 read/plan/write/control invoke 命令已实现，Provider 写入还需 Creator 原生批准。当前后续工作是补重载、漂移和断连恢复验收，不应再把“没有通用 Editor 命令执行”列为实现缺口。
- 当前工作树将 CLI 版本设为 `0.11.0`、Creator 扩展设为 `0.7.0`。新增 `creator.script.modify.plan/commit/reconcile`：计划绑定目标路径、现有 AssetDB UUID/importer、当前源码 SHA-256、`.meta` SHA-256 和完整替换源码；提交通过 Creator 原生审批和第二次前态校验后调用 `Editor.assetdb.saveExists`，回读源码及 AssetDB 身份；旧源码保存在项目外，恢复需要新计划，不自动重试。`.meta` 不写入。诊断回执只报告编译游标后的 Creator 事件，事件未命名目标脚本时不归因给它；`compile-finished` 单独不证明编译成功。
- 新增自动化测试覆盖完整 AssetDB 替换/读回/reconcile、`.meta` 保持、过期源码哈希、审批取消、计划后冲突、原生审批弹窗等待期间的并发源文件变化；扩展生命周期测试覆盖安装、0.6.2→0.7.0 更新、默认漂移拒绝、隔离 home 中的强制备份和卸载。完整 CLI 测试 **65/65 通过**；`node --check`、合同 JSON 解析和 `git diff --check` 通过。这些属于 CLI/模拟 AssetDB 证据，不是 Creator 实机修改。
- 使用旧标签 `cocos-creator-agent-cli-v0.10.6` 的 CLI 在 `/private/tmp/cocos-cli-0.11.0-lifecycle/project` 安装受管理扩展 0.6.2；当前源码 CLI `extension status` 确认无本地漂移，`extension update` 将其更新至 0.7.0。手动制造的 `main.js` 漂移令 `changedFiles` 精确报告 `main.js`，默认 update 返回 `EXTENSION_LOCAL_CHANGES:main.js`。恢复该临时夹具后，当前 CLI 执行 uninstall 并由 status 确认未安装。此为临时项目 CLI 生命周期验收，没有启动 Creator 编辑器。
- 候选包位于 `/private/tmp/cocos-cli-release-0.11.0/cocos-creator-agent-cli-0.11.0.tgz`：98 个条目、179,024 字节，SHA-256 `c55f0596946e02c501e971b0ba21ee9e0d867b8f91d56ce9959fcfd41229e1d9`，sidecar 与该值一致。隔离 prefix 安装返回 CLI `0.11.0`、目标 Creator `2.4.15`；`catalog --format json` 返回 33 条固定命令并包含三条 `creator.script.modify.*`。这是本地候选包验收，未发布。
- Creator 实机写入仍未验收：`tank` 目前 AssetDB 没有现成 JS/TS 样本可供修改；为守住干净基线，本轮没有再创建新资源或更换项目内扩展。新命令的 Creator `saveExists`、Creator 2.4.15 编译事件关联和运行效果仍需在有明确临时脚本样本的编辑器会话中验证。
- 线上发布仍阻塞：Chrome 中 0.10.6 Release 表单保留 `cocos-creator-agent-cli-v0.10.6` 标签与待附加资产，页面显示 billing 警告，按钮停在禁用的 `Publishing…`；没有可核实的 Release 成功页或线上资产。没有改动 Chrome 扩展权限，也没有尝试绕过策略。GitHub Actions 与 0.10.6 线上自更新/回滚继续未验收，0.11.0 不发布。
- 本轮 npm 默认缓存 `/Users/youjunmao/.npm` 返回 root-owned 文件 `EPERM`，因此使用 `/private/tmp/cocos-cli-pack-cache` 和隔离安装 prefix；未递归修改系统 npm 缓存权限。仓库中 `.DS_Store` 与 `tank/packages/cocos-creator-agent-extension/` 的脏文件属于既有工作区状态，本轮未暂存、未提交、未覆盖。

## 2026-10-21 续验：CLI/MCP 0.11.0 Creator 脚本修改实机闭环

- 通过 Cocos Dashboard 项目列表核对 `tank`：项目名 `tank`，Dashboard 登记父目录 `/Users/youjunmao/WORK/Cocos_Engine`，Creator 2.4.15；Creator 与 MCP 随后报告完整工程根 `/Users/youjunmao/WORK/Cocos_Engine/tank`。退出旧 Creator 后从 Dashboard 打开该条目，避免把同目录下的 `tankwar`/`LinkUpClient` 当目标。
- 用已验证的本地 tarball 将用户级全局 CLI 从 `0.10.6` 更新至 `0.11.0`，现有 Codex MCP 配置仍指向同一 CLI 路径。重启本机桥接后，健康回执为 CLI `0.11.0`、Creator `2.4.15`、扩展 `0.7.0`，合同 SHA-256 `fe71e1802c40965d9104d2c988637dfeced38313129fd0758d167271291c83df`。Creator 实例 `b88c2983-3caa-440f-874e-b70207afc1ef` 报告 `tank` 完整根路径；`doctor` 最终 9/9 通过、0 警告、0 错误；CLI 与 MCP 能力目录均见 33 条可用命令，包含三条 `creator.script.modify.*`。MCP 通过通用持久任务工具运行新修改命令。
- Creator AssetDB 起始搜索为空。经 Creator 原生确认创建临时脚本 `db://assets/CodexScriptModifyAcceptance20261021.ts`：UUID `1cd69ee8-b073-49c4-9a26-307107494600`，TypeScript importer，初始源码 SHA-256 `3dbb38d38418fe5c9d1082118c282d7584e36e47a8bcbdacd8e4e41b525c4718`，`.meta` SHA-256 `4778426121dd5a28b4eaa5fdb710062dc17ebfa46b43128154c7e397d1e5cb26`。CLI 与 MCP 的 `script.read` 返回相同源码、UUID 和哈希。
- CLI 生成修改计划 `93a6808d-daf4-4bf1-9017-8b7aad591544`，把公开数值从 `1` 改为 `2`，绑定前态源哈希、AssetDB UUID/importer 与 `.meta` 哈希；经 MCP `tasks.start` 提交后，在 Creator 原生对话框批准，任务 `a8fcf834-994b-4b09-ab51-dbd954f35b98` 完成。Creator AssetDB 回读哈希为 `07bb76a3b90492e5e9b2ba0183fd5132ce5aa8983699eb07828cc089f9e9156b`，UUID、importer、`.meta` 哈希均未变化。MCP reconcile 回读该操作为 completed。
- 用 MCP 任务生成反向恢复计划 `4dd5636d-da06-483f-b575-1751acbcc367`，再由 CLI 提交，并经第二次 Creator 原生批准将源码恢复为初始字节。CLI 与 MCP 读回源哈希恢复为 `3dbb38d38418fe5c9d1082118c282d7584e36e47a8bcbdacd8e4e41b525c4718`，UUID/importer/`.meta` 哈希一致；MCP reconcile 观察到原始源码与元数据状态。
- 前态防护负向检查：以 64 个零作为错误的 `expectedSourceSha256` 请求计划，CLI 拒绝并返回 `SCRIPT_SOURCE_PRECONDITION_FAILED`，没有生成写入操作。恢复写入回执仍标注 `compile.status: pending`；在 Creator 开发者菜单手动触发“编译脚本”后，诊断读取仍为 sequence 0、无 `compile-finished`/错误事件。Creator Console 截图只显示 `cloud-function unloaded`，因此源码修改/恢复已通过实机回读，编译结果仍不能判为通过。
- 截至本记录更新时，临时脚本源码已恢复，但该唯一验收脚本仍在 `tank/assets/`。Creator 资源删除不可撤销；为恢复空工程，下一步需要在删除动作发生前再次确认，并从 Creator AssetDB/资源管理器删除后回读 0 项。未用磁盘直接删除伪装 Creator 回执。
- 本地 0.11.0 tarball SHA-256 `c55f0596946e02c501e971b0ba21ee9e0d867b8f91d56ce9959fcfd41229e1d9` 已安装到全局 CLI；这是本机更新验收，不是线上发布。GitHub Release 页面仍显示 billing locked/发布按钮禁用，本机 GitHub MCP 能力目录没有创建 Release/上传资产接口；未发布 0.11.0，线上自更新/回滚仍未验收。

## 2026-10-21 续验：验收资源清理与桥接复核

- Creator UI 中选中 `db://assets/CodexScriptModifyAcceptance20261021.ts` 并显示永久删除警告；按用户对本次验收清理的授权确认后，通过 Creator 资源管理器删除。资源树已不再显示该脚本；随后 Creator AssetDB 全量搜索 `total: 0`，项目搜索该脚本名 `total: 0`，`script.read` 返回 `ENOENT`。删除只通过 Creator UI 执行，没有用磁盘操作伪造 Creator 回执。
- 用户同时授权清理 `CocosCliAcceptance20261020.ts` 与 `CocosCliAcceptance20261020.fire`。Creator AssetDB 对两个完整名称分别搜索均返回 `total: 0`，项目搜索共同前缀亦为 `total: 0`；它们在本次清理前已不存在，因此没有重复删除。
- 清理后 Creator MCP 仍报告实例 `b88c2983-3caa-440f-874e-b70207afc1ef`、工程根 `/Users/youjunmao/WORK/Cocos_Engine/tank`、Creator 2.4.15、扩展 0.7.0。活动场景 `New Node`（UUID `1apMQWcGJEA5Hek6MHPJtY`）快照仍为 3 个节点：根节点、Canvas、Main Camera。诊断 sequence 0、`latestCompile: null`、events 为空；编译结果仍未确认。
- CLI 0.11.0 `bridge status` 报 bridge ID `d7523603-a0fa-473e-bb37-c0e41343df4a` 正在运行，扩展版本/协议/命令指纹匹配。受限终端沙箱首次执行 `doctor` 时无法访问 loopback；在允许访问已运行本机桥接的检查上下文中，`doctor --project-root .../tank --instance b88c2983-3caa-440f-874e-b70207afc1ef` 共 9 项通过、0 警告、0 错误，33/33 Creator 命令可用。
- tank 源资源和场景恢复为默认空样本；项目级扩展源代码仍有本任务的 0.7.0 变更，另有未提交工作区内容。本次没有提交 Git，也没有触碰 `.DS_Store` 或其他未相关文件。

## 2026-10-21 续验：Creator CLI Web-Mobile 构建负向验收

- 使用已安装 CLI `0.11.0` 对已核实的 `tank`（Creator 2.4.15）执行 `creator build --platform web-mobile --debug`，指定新的外部输出目录 `/private/tmp/cocos-cli-web-mobile-acceptance-20261021`。原受限 shell 的首次启动在 AppKit 注册阶段触发 Creator `SIGABRT`，没有工程/输出变化；随后在允许本机 Creator 应用启动的上下文重试，Builder 初始化成功并通过桥接连接 tank。
- Creator Builder 日志明确返回 `Build Failed: Failed to find start scene in scene list.`。CLI JSON 回执：`exitCode: 0`、`outputExists: false`、`timedOut: false`、`success: false`；stdout 含 Builder 初始化日志，stderr 含失败原因和 Creator 自身弃用/profile 警告。目标输出目录不存在。结论为：失败识别有效，但空 tank 没有可用于发布的已登记启动场景，本轮没有成功构建证据。
- CLI 构建子进程短暂注册 Creator 实例 `6509cf8e-c51d-42a9-b6c4-16a8c5036788`，同为 tank、Creator 2.4.15/扩展 0.7.0，`activeScene: null`。该子进程结束后等待 45 秒实例 TTL；后续 MCP 实例列表和显式 CLI `doctor` 均只保留原交互实例 `b88c2983-3caa-440f-874e-b70207afc1ef`，doctor 9/9 通过、无警告/错误。
- 构建后 Creator AssetDB 仍为空、活动场景仍为默认 `New Node`，tank 的 assets/settings/build 目录没有 Git 差异；没有为通过构建而改变用户工程基线。成功构建需要后续在 Creator 中创建并登记一个启动场景，再在指定外部输出目录重试。

## 2026-10-21 续验：Builder 失败结构化回执

- 对实际 Creator Builder 返回的失败记录：虽然 Creator 子进程退出码为 0，但 stderr 含 `Error: Build Failed: Failed to find start scene in scene list.`，且输出目录不存在；CLI 原回执 `success: false`。这验证了失败被识别，但原因此前只能从 stderr 中读取。
- 更新 `creator-workflows.mjs`：解析 `Build Failed:` 日志，回传 `failureCode: CREATOR_BUILD_REPORTED_FAILURE` 与具体 `failureReason`；对有部分输出目录的情况仍以 Builder 显式失败为准。新增自动化回归用例模拟“退出码 0、输出目录存在、stderr 有 Builder 失败”，并断言不报告成功。
- CLI 测试先在受限沙箱跑出 63/66；3 个集成测试因本机测试桥接 bind `127.0.0.1` 被 `EPERM`。随后在允许测试绑定本机回环的执行上下文运行完整 `npm test`，**66/66 通过**。
- 重新打包并全局安装本地 CLI `0.11.0` 候选：`/private/tmp/cocos-cli-release-0.11.0-r1/cocos-creator-agent-cli-0.11.0.tgz`，98 个条目、179,198 字节，SHA-256 `496321bfb89a2ef2b62344cab2994b335307e4f030706050e71c4bec8c705407`；旁置 `.sha256` 文件。安装后全局版本仍为 0.11.0，已安装 `creator-workflows.mjs` 含新失败码；CLI `doctor --project-root .../tank --instance b88c2983-3caa-440f-874e-b70207afc1ef` 为 9/9 通过，33/33 命令可用。
- 此次只对模拟 Builder 回执和 Creator 实际捕获的失败日志完成验证；没有为了成功构建而更改空 tank。成功构建仍需在 Creator 中登记 start scene，再重跑机器构建并核对产物。
- 为把新回执规则随 CLI/Agent Skill 一起交付，同版本最终候选包在补充 README 与 `cocos2-cli` Skill 后重新打包：`/private/tmp/cocos-cli-release-0.11.0-r2/cocos-creator-agent-cli-0.11.0.tgz`，98 个条目、179,439 字节，SHA-256 `b3d7ba49a7c27442908ef2d1cae303d624e21f2efad872230ee4633b3368cf82`，旁置 SHA-256 文件。已全局重新安装；确认全局 `creator-workflows.mjs`、README 和 `cocos2-cli/SKILL.md` 均包含失败字段约定，CLI `doctor` 再次 9/9 通过、桥接只发现原 tank 实例。版本仍为 0.11.0；因为尚未公开发布，局部候选包可在保持该版本下刷新。
- 实机 r2 回执还显示 Creator Builder 写出明确的“没有启动场景”错误后，Creator 进程继续运行到 CLI 的 360 秒超时。CLI 同时返回 `timedOut: true` 与 `failureReason`，但先前优先显示通用 `CREATOR_WORKFLOW_TIMEOUT`。修正优先级为：明确 Builder 失败先作为 `failureCode: CREATOR_BUILD_REPORTED_FAILURE`，同时保留 `timedOut: true`；新增超时与 Builder 错误并存的自动化用例。
- 最终本地候选包 r3：`/private/tmp/cocos-cli-release-0.11.0-r3/cocos-creator-agent-cli-0.11.0.tgz`，98 个条目、179,445 字节，SHA-256 `3dddb3a8abde25b2d1d19d99898c8294260d796802d90cb05c0ff77f7ea004c3`，`.sha256` sidecar 一致。已覆盖式全局安装；版本 `0.11.0`。全量 CLI 测试 **67/67 通过**；最终本机 `doctor` 为 **8/8 通过**，0 警告、0 错误。此修正由针对真实 Builder 失败文本和超时状态的自动化回归验证，未再次启动 Creator 构建。
- 2026-10-21 再验：工作树重新 `npm test`，沙箱模式下 3 个需要绑定 `127.0.0.1` 的桥接测试被 EPERM 拒绝；在允许本机回环绑定的执行上下文重跑后 **67/67 通过**。从当前工作树重打包得到 r4，仍是 98 个条目、179,445 字节，SHA-256 与 r3 完全相同：`3dddb3a8abde25b2d1d19d99898c8294260d796802d90cb05c0ff77f7ea004c3`。
- 当前 Creator 2.4.15 实例仍报告工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`、扩展 0.7.0、活动场景 `New Node`；MCP `creator.extension.commands.list` 异步任务完成，回执 `providers: []`，因此本轮只确认了发现命令正常返回，未验证第三方 Provider IPC 执行。临时验收脚本的 AssetDB 查询为 0，场景快照仍为默认三节点。
- 最新 CLI `doctor --json` 返回 **8/8**、0 警告、0 错误，合同指纹 `fe71e1802c40965d9104d2c988637dfeced38313129fd0758d167271291c83df` 与实例一致。当前 GitHub Release 页面仍以 0.10.6 为 latest，并显示账号 billing 问题；本机 `gh` CLI 未安装，`cocos-creator-agent self-update --check` 返回 `fetch failed`，`git ls-remote` 返回 GitHub empty reply。故 0.11.0 仍是本地候选，尚无线上下载、安装、更新或回滚证据。
