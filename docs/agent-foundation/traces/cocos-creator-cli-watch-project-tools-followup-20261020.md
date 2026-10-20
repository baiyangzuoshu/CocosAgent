# Cocos CLI watch 与项目工具别名后续记录

日期：2026-10-20。范围：在 CLI 0.8.0 已完成的 MCP/Skill 安装与 Creator 命令基础上，补充安全的项目命令发现和同一预览会话中的持续 smoke-test。

## 本次实现

- `.cocos-agent/tools.json` 可以把项目内易记 ID 映射到共享合同已有命令。映射沿用原输入 schema、访问级别和审批字段；允许 read/plan，以及合同声明 Creator 原生审批的 write/control。拒绝自定义 schema、执行回调、桥接命令和未审批副作用。MCP 的动态工具描述不使用项目提供的标题/描述。
- 新增 `creator watch`：调用者显式传入最多 32 个工程相对文件路径；只读取所列文件的状态/哈希，确认改动稳定后 refresh 原预览会话并重跑同一组 `creator.preview.interact` 输入。输出 NDJSON 事件，Ctrl+C/SIGTERM 结束。拒绝越界路径、符号链接、非普通文件、单文件超过 8 MiB、总量超过 32 MiB，以及不在 250–10000 ms 范围内的轮询周期。
- watch 先通过 `creator.preview.observe` 确认传入的预览会话，再建立文件基线；修改后的刷新和断言始终绑定相同 Creator instance 与 preview session。
- `creator watch` 是运行时 smoke-test 持续回归，不是 Creator 单元测试运行器，也不提供 Unity Pipeline 一样的第三方 Editor 命令执行插件 API。

## 本机验证

- CLI 包版本提升为 `0.8.1`，Creator 扩展仍为 `0.5.0`。
- `npm test`：29/29 通过。其中 MCP 集成测试通过本机临时 loopback 服务运行。
- `node --check cli.mjs`、`node --check creator-watch.mjs`、任务相关 `git diff --check`：通过。
- CLI `--help` 列出 `creator watch`。
- `npm pack`：0.8.1 包含 88 个文件，压缩 152,977 bytes、解包 640,245 bytes；tarball SHA-256：`b6db23a908543f128c804cbe54aff84e662f8466b15d87eb405a36ba4e9526cc`。隔离 npm prefix 安装并升级成功；安装后的 `version` 为 0.8.1，`--help` 含 `creator watch`。升级基线是本轮临时生成的未发布 0.8.0 快照，不代表线上 0.8.0 Release。
- npm 默认缓存目录因权限问题拒绝写入；使用 `/private/tmp` 下的隔离缓存完成打包和安装。未改 npm 全局目录或用户缓存。
- `doctor` 最初读到仍运行的 bridge `extensionVersion=0.4.0`、合同指纹旧，与当前 CLI 0.8.1 / 扩展 0.5.0 不匹配；PID 确认是旧 CLI bridge，且无 Creator 实例。通过 CLI 停止旧 bridge、启动当前 bridge 后重跑只读 `doctor`：6 项通过、0 警告、0 错误；实例数 0。当前指纹 `c20bb0567a1f911114c24a67402e23a7bb7d934aca4b4533d63b50df7758571e`。

## 未验收与限制

- 本轮 UI 状态显示 Cocos Creator 未运行；未加载 Creator 工程、未调用 Creator 命令，因此 watch、写操作和运行诊断均无 Creator 实机回执。
- `creator test/watch` 只复用既有的 Web 预览交互断言；项目自定义单元测试命令与结果发现仍未实现。
- 项目注册表仍只能映射共享合同命令；真正的已安装 Editor 扩展自定义命令注册/执行 API仍待设计与隔离 Creator 验收。
- 此 0.8.1 tarball 是本地验收产物；没有推送 GitHub Release 标签，也没有线上 `self-update` 回执。先前已验收的 0.8.0 tarball内容保持原记录，不把本次 watch 源码冒充已发布版本。
- Codex/Claude 桌面 Host 的 MCP 工具目录重载验收未做；自动化 stdio 测试不能代替桌面 Host 验收。
