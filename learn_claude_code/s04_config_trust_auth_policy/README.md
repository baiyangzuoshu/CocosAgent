# 第 04 课：配置、信任、认证与策略边界

**目标：** 沿启动主链分清配置读取、工作目录信任、凭据获取和组织策略检查各自控制什么，以及它们在交互模式和 `--print` 模式中的先后关系。

## 本课要回答的问题

1. 为什么读取项目配置不等于允许执行配置中的命令？
2. 交互式信任确认保存在哪里，父目录的信任如何影响子目录？
3. `--permission-mode`、`--dangerously-skip-permissions` 与工作目录信任是什么关系？
4. 项目配置中的 `apiKeyHelper` 何时可以执行？
5. 组织策略何时加载，策略服务不可用时哪些判断会放行？

## 本课调用链

启动早期可以读取本地配置；其中可能触发代码或外部访问的工作则要经过信任边界。交互会话通过 `showSetupScreens()` 检查信任：未信任目录要先接受对话框，之后才继续完整环境变量应用、系统上下文预取、MCP 审批等工作；已信任目录会跳过对话框。`--print` 不经过交互设置屏幕，源码将其视为隐式信任路径。

~~~mermaid
flowchart TD
  A[读取设置与本地 MCP 配置] --> B{交互会话?}
  B -->|是| C{工作目录已信任?}
  C -->|否| D[显示 TrustDialog]
  C -->|是| E[建立本次会话信任]
  D -->|接受| E
  E --> F[应用完整环境变量]
  E --> G[预取系统上下文与处理 MCP 审批]
  E --> H[允许受信任设置中的 Helper 执行]
  B -->|否: --print| I[跳过交互对话框，按隐式信任处理]
  I --> F
  I --> G
  I --> H
  F --> J[继续会话初始化]
  G --> J
  H --> J
  J --> P[工具调用]
  K[权限模式] --> P
  Q[CLI 初始化] --> L[后台加载组织策略]
  J --> M[远程会话等待策略加载]
  L --> M
  M --> N[检查 allow_remote_sessions]
~~~

读取配置和执行配置指定的代码、访问外部资源是不同阶段。例如，源码允许在信任对话框前读取 MCP 配置文件以重叠 I/O，但明确把 MCP 资源预取推迟到信任之后；项目或本地设置中的 `apiKeyHelper` 也有单独的信任检查。

## 四个概念分别回答什么

| 概念 | 主要问题 | 源码中的边界 |
| --- | --- | --- |
| 配置 | 有哪些设置、环境变量和工具来源？ | 启动早期可读取配置；只先应用安全环境变量，完整环境变量应用发生在信任确认后或 `--print` 路径 |
| 工作目录信任 | 是否同意 CLI 在当前项目中读取、编辑或执行内容？ | 交互模式显示信任对话框，与工具权限模式分开；接受状态按会话或项目配置记录 |
| 认证 | 当前请求使用哪种凭据来源？ | `auth.ts` 处理 API key、`apiKeyHelper` 等来源；来自项目或本地设置的 Helper 在交互模式下受信任门控 |
| 组织策略 | 管理员对某项功能是否施加限制？ | 策略模块按认证资格获取并缓存限制；具体功能入口检查具名策略，例如远程会话检查 `allow_remote_sessions` |

## 信任状态与模式分支

- `showSetupScreens()` 只由交互路径调用。源码注释明确写明，信任对话框在交互会话中独立于权限模式显示；`bypassPermissions` 控制工具执行权限，不代替工作目录信任。
- 信任接受时，如果当前目录是用户主目录，状态只保存到本次会话；其他目录则写入项目配置 `hasTrustDialogAccepted`。信任查询也会检查项目路径和父目录，因此已信任父目录会覆盖其子目录。
- `checkHasTrustDialogAccepted()` 对已接受状态做会话内缓存；未接受状态会重新读取，从而能发现本次运行中刚接受的信任。
- `--print` 跳过交互设置屏幕。源码将非交互路径视为隐式信任，并在那里应用完整环境变量；CLI 帮助也提醒只在可信目录中使用该模式。
- MCP 配置可在信任前作为本地文件读取；未信任目录的 MCP 资源预取、交互式服务器审批和插件 LSP 初始化则位于信任之后。已信任目录可在启动早期预取系统上下文。

因此，“当前目录已信任”和“工具调用是否需要确认”是两种不同状态，不要把 `--permission-mode` 或跳过工具权限检查理解为跳过信任流程。

## 认证与组织策略

`getAnthropicApiKeyWithSource()` 根据运行模式和凭据状态选择认证来源。`--bare` 路径刻意收窄为环境变量 `ANTHROPIC_API_KEY` 或 `--settings` 提供的 `apiKeyHelper`，不读取 OAuth 或 Keychain。普通模式还有其他认证路径，本课不展开其完整优先级。

对于来自 `projectSettings` 或 `localSettings` 的 `apiKeyHelper`，执行函数会检查工作目录信任；交互会话尚未确认信任时返回空结果，预取函数也会跳过它。非交互模式的信任按隐式路径处理。`auth.ts` 对 AWS 刷新命令也有类似的项目设置门控。

组织策略不是凭据本身，也不是工具权限规则。`loadPolicyLimits()` 在 CLI 初始化中以后台方式启动；远程会话和 teleport 路径会等待初次加载，再检查 `allow_remote_sessions`。策略模块只对满足资格的账户加载限制，包括可取得 API key 的 Console 用户，或具有 inference scope 的 Team/Enterprise OAuth 用户。

当前快照中的 `isPolicyAllowed()` 在限制未知、不可用或缺失时通常放行；源码为 essential-traffic-only 场景下的 `allow_product_feedback` 保留了失败关闭例外。因此，不能把“策略服务失败”概括为一律拒绝，也不能忽略个别策略的例外。

## 源码对照

- `AI/claude-code-analysis-main/src/entrypoints/init.ts:62-84`：启用配置后，信任前只应用安全环境变量。
- `AI/claude-code-analysis-main/src/main.tsx:1800-1816`：在信任流程前读取本地 MCP 配置；注释将 MCP 资源预取明确延后。
- `AI/claude-code-analysis-main/src/main.tsx:354-379`：系统上下文预取区分交互信任状态和 `--print` 非交互模式。
- `AI/claude-code-analysis-main/src/main.tsx:2217-2242`：只在交互路径运行 `showSetupScreens()`。
- `AI/claude-code-analysis-main/src/interactiveHelpers.tsx:125-170`：信任对话框与权限模式的关系；接受信任后设置会话状态、预取系统上下文并处理 MCP 与 CLAUDE.md 审批。
- `AI/claude-code-analysis-main/src/interactiveHelpers.tsx:180-190`：信任后的完整环境变量应用和遥测初始化。
- `AI/claude-code-analysis-main/src/components/TrustDialog/TrustDialog.tsx:157-179`：拒绝时退出；接受时主目录只记录会话信任，其他目录写入项目配置。
- `AI/claude-code-analysis-main/src/utils/config.ts:674-742`：项目配置键、会话级信任检查、持久化配置与父目录遍历。
- `AI/claude-code-analysis-main/src/main.tsx:2584-2597`、`AI/claude-code-analysis-main/src/utils/config.ts:697-742`：`--print` 的隐式信任路径和信任状态查询。
- `AI/claude-code-analysis-main/src/utils/auth.ts:226-265`：API key 来源选择入口及 `--bare` 的限制。
- `AI/claude-code-analysis-main/src/utils/auth.ts:351-378,538-603`：识别项目或本地设置中的 `apiKeyHelper`，以及执行和预取前的信任检查。
- `AI/claude-code-analysis-main/src/services/policyLimits/index.ts:175-221,502-575`：策略资格、初次加载等待、未知策略默认值和失败处理。
- `AI/claude-code-analysis-main/src/main.tsx:953-959,3401-3407`：策略后台加载，以及远程会话入口的等待和检查。
- `AI/claude-code-analysis-main/src/main.tsx:2317-2321`：交互信任建立后（或非交互隐式信任路径）初始化 LSP 管理器。

## 静态观察

在仓库根目录执行以下命令，只检查源码，不启动 CLI：

~~~sh
nl -ba AI/claude-code-analysis-main/src/interactiveHelpers.tsx | sed -n '125,190p'
nl -ba AI/claude-code-analysis-main/src/utils/config.ts | sed -n '674,760p'
nl -ba AI/claude-code-analysis-main/src/utils/auth.ts | sed -n '226,265p;351,378p;538,603p'
nl -ba AI/claude-code-analysis-main/src/services/policyLimits/index.ts | sed -n '175,221p;502,575p'
rg -n "showSetupScreens|applyConfigEnvironmentVariables|allow_remote_sessions" AI/claude-code-analysis-main/src/main.tsx
~~~

## 观察结果

启动顺序体现了分层防护：配置文件可以先读取，但涉及外部行为的资源预取、设置 Helper、完整环境变量和插件 LSP 都要考虑信任时机；交互式信任状态、工具权限模式、认证来源和组织策略分别由不同模块管理。`--print` 明确走跳过信任对话框的非交互路径，使用前提是调用方信任工作目录。

## 简化与限制

- 本课描述的是当前源码快照中的静态调用与条件分支，不代表对 Claude Code 二进制的运行时验证。
- 信任、认证和组织策略还有多条边缘路径；本课只跟踪默认 CLI 会话和远程会话策略门控。
- 策略服务、配置源的完整优先级，以及具体工具的权限评估留给后续课程。
