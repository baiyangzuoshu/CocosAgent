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
