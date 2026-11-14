# 第 03 课：命令执行前的初始化

**目标：** 还原 CLI 从启动期预取到 Commander `preAction` 的初始化顺序，区分必须等待的准备、共享的 `init()` Promise，以及只在后台启动的工作。

## 本课要回答的问题

1. 为什么 MDM 和 Keychain 读取会在命令 action 前预先启动？
2. `preAction` 等待哪些结果，之后才调用 `init()`？
3. `init()` 的同步准备、后台任务和远程设置加载怎样排序？
4. 配置解析错误在交互与非交互模式下怎样收尾？

## 本课调用链

`main.tsx` 在模块加载阶段启动 MDM 原始读取和 Keychain 预取。Commander 选中一个实际 action 后，根级 `preAction` 等待这两项预取，再等待 memoized 的 `init()`。完成后，它继续挂载日志、应用命令级插件目录、执行迁移，并在后台启动远程设置和策略加载。

~~~mermaid
flowchart TD
  A[main.tsx 顶层启动 MDM 与 Keychain 预取] --> B[Commander 选中 action]
  B --> C[preAction 等待两项预取]
  C --> D[await init() memoized Promise]
  D --> E[启用配置并应用安全环境变量]
  E --> F[注册优雅退出与清理]
  F --> G[启动遥测、OAuth、IDE、仓库等后台任务]
  G --> H[配置 mTLS 与 HTTP Agent]
  H --> I[预连接 API；远程模式可启动上游代理]
  I --> J[preAction 初始化 sinks、迁移]
  J --> K[后台加载远程设置与策略]
  K --> L[执行选中的 action]
~~~

图中“后台任务”不代表 `init()` 会等待它们全部结束。需要区分 `await`、普通同步调用和 `void` 发起的异步工作。

## 源码对照

- `AI/claude-code-analysis-main/src/main.tsx:1-20`：在完整 CLI 导入期间的顶层代码中启动 MDM 原始读取和 Keychain 预取；注释说明目标是让这些工作与剩余模块加载重叠。
- `AI/claude-code-analysis-main/src/main.tsx:905-917`：`preAction` 等待 `ensureMdmSettingsLoaded()` 和 `ensureKeychainPrefetchCompleted()`，随后 `await init()`。
- `AI/claude-code-analysis-main/src/entrypoints/init.ts:54-88`：`init` 由 `memoize` 包装；先启用配置，只应用信任建立前允许的环境变量，并配置额外 CA 证书和优雅退出。
- `AI/claude-code-analysis-main/src/entrypoints/init.ts:90-132`：以不阻塞主流程的方式启动遥测、OAuth 账户信息、IDE/仓库检测，并准备远程设置和策略的加载 Promise。
- `AI/claude-code-analysis-main/src/entrypoints/init.ts:134-183`：配置 mTLS 和全局 HTTP Agent，预连接 API；仅在远程环境下动态加载并等待上游代理启动，失败时记录并继续。
- `AI/claude-code-analysis-main/src/entrypoints/init.ts:185-214`：设置 Windows Shell、注册 LSP 和团队清理函数，必要时创建 scratchpad，然后记录初始化完成。
- `AI/claude-code-analysis-main/src/main.tsx:919-966`：`init()` 返回后设置进程标题、初始化日志 sinks、接入 `--plugin-dir`、运行迁移，并以不阻塞 action 的方式启动远程设置、策略和可选设置同步。
- `AI/claude-code-analysis-main/src/entrypoints/init.ts:215-237`：配置解析错误在非交互模式打印到 stderr 并同步退出；交互模式动态打开配置错误对话框；其他错误重新抛出。

## 等待关系

| 工作 | 如何启动 | `preAction` / `init()` 是否等待 |
| --- | --- | --- |
| MDM 和 Keychain 预取 | `main.tsx` 模块级调用 | `preAction` 通过 `Promise.all` 等待 |
| 配置启用、安全环境变量、CA 配置 | `init()` 内同步调用 | 等待 `init()` 完成 |
| 遥测、OAuth、IDE 和仓库检测 | `init()` 内 `void` 启动 | 不等待这些后台任务全部结束 |
| mTLS、HTTP Agent | `init()` 内同步调用 | `init()` 完成前执行 |
| Anthropic API 预连接 | `init()` 内调用 | 发起后不等待连接结果 |
| 远程上游代理 | 远程环境下动态导入 | 条件命中时 `await initUpstreamProxy()` |
| 远程设置、策略、设置同步 | `preAction` 在 `init()` 后启动 | 不阻塞当前 action |

## 静态观察

在仓库根目录执行以下命令，核对预取位置、等待点和 `init()` 各阶段；不启动 CLI：

~~~sh
nl -ba AI/claude-code-analysis-main/src/main.tsx | sed -n '1,20p'
nl -ba AI/claude-code-analysis-main/src/main.tsx | sed -n '905,967p'
nl -ba AI/claude-code-analysis-main/src/entrypoints/init.ts | sed -n '54,238p'
rg -n "void |await |memoize\(async|ConfigParseError" AI/claude-code-analysis-main/src/entrypoints/init.ts
~~~

## 观察结果

初始化不是单一同步的“启动完成”点：命令执行前会等待 MDM/Keychain 预取和 `init()`，但遥测、OAuth 信息、仓库检测、API 预连接以及远程设置等工作可能仍在后台运行。源码在初始化流程内用明确的 `await`、`void` 和同步调用表达这些差异。

`initializeTelemetryAfterTrust()` 是 `init.ts` 中另一个独立入口，用于信任建立后的遥测初始化；它不等同于本课的早期 `init()`，详细信任边界留在第 04 课。

## 简化与限制

- 这些是源码中的调用次序和等待关系，不是启动耗时测量或运行时验收。
- MDM、Keychain、mTLS、远程设置等具体实现留在各自专题；本课只说明它们在启动顺序中的位置。
- 当前快照没有构建入口，本课只做静态源码跟读。
