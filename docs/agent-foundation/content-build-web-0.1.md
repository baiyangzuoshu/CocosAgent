# Creator 2.4 Web-Mobile 内容构建合同 0.1

此切片把已选中的 `built-in-resources` 内容版本交给 Creator 2.4.15 构建成 Web-Mobile 包，并核对输出是否包含清单中每张 Texture2D。它只支持 2.4.15 与 `web-mobile`；不处理 Creator 3.8、Asset Bundle、原生包、远端发布或热更新。

## 方法

| 方法 | 输入 | 行为 |
| --- | --- | --- |
| `content.build.plan` | `projectRoot`、`creatorVersion: "2.4.15"`、`releaseId`、`expectedFingerprint`、`buildId` | 只读重验当前 selected release、PNG 字节、meta UUID 和 Creator 安装版本；生成隔离输出路径及 CLI 参数 |
| `content.build.execute` | 与 plan 相同 | 先原子占用 buildId，再以参数数组启动 Creator 命令行构建；成功后扫描 Web 包并逐项核对 resources 配置、压缩 UUID、import JSON 与 PNG native 文件 |
| `content.build.get` | `projectRoot`、`creatorVersion`、`buildId` | 读取 `.cocos-agent/content-builds/<buildId>.json` 的持久结果 |
| `content.build.reconcile` | 与 get 相同 | 对 Host 中断后仍为 `running` 或 `needs-review` 的记录，只读校验已有包；不重启 Creator、不重做构建 |

`buildId` 只允许小写字母、数字和连字符，长度 3–32。输出被固定派生到 `build/cocos-agent/<buildId>`，要求此前不存在；冲突会拒绝构建，不清空或覆盖旧输出。CLI 不经过 shell。构建入口场景从 `settings/builder.json`（缺失时回退 `settings/builder.panel.json`）读取，并通过对应 `.fire.meta` 与磁盘场景文件双重确认，再显式传入 `startScene`。Creator 版本从应用包 `Info.plist` 核验；默认查找 `/Applications/Cocos/Creator/2.4.15/CocosCreator.app`，也可通过 `COCOS_CREATOR_2_4_15_EXECUTABLE` 指向 Creator 2.4.15 应用包内的可执行文件。构建最多等待 20 分钟。

请求 schema 见 [`content-build.schema.json`](../../tools/cocos-agent-bridge/content-build.schema.json)。

Host 仅在 Creator 进程以成功状态退出后检查产物；还须找到 Web `index.html` 与 `name: "resources"` 的 bundle 配置。每个资源需同时满足：路径项等于 release 的 `runtimePath`、type 为 `cc.Texture2D`、UUID 与 2.4 压缩 UUID 一致，并且导入 JSON 和 PNG native 文件均存在于此输出包中。导入 JSON 可由独立资源文件提供，也可由 `config.packs` 与 `versions.import` 指向的 pack 文件提供；UUID 压缩时，只有编码首字符为 `/` 才用斜线作分隔符。Creator 命令退出成功但任何资源缺失时，operation 为 `needs-review`，不会报告构建验收成功。失败输出保留用于诊断；应使用新 buildId 重试。

示例调用顺序：

```json
{"id":1,"method":"content.build.plan","params":{"projectRoot":"/absolute/project","creatorVersion":"2.4.15","releaseId":"sample-release","expectedFingerprint":"<64-char-fingerprint>","buildId":"web-smoke-01"}}
{"id":2,"method":"content.build.execute","params":{"projectRoot":"/absolute/project","creatorVersion":"2.4.15","releaseId":"sample-release","expectedFingerprint":"<64-char-fingerprint>","buildId":"web-smoke-01"}}
{"id":3,"method":"content.build.get","params":{"projectRoot":"/absolute/project","creatorVersion":"2.4.15","buildId":"web-smoke-01"}}
{"id":4,"method":"content.build.reconcile","params":{"projectRoot":"/absolute/project","creatorVersion":"2.4.15","buildId":"web-smoke-01"}}
```

## 证据状态

- 2.4 官方命令行发布手册确认 `--path`、`--build`、`platform`、`buildPath` 和 `md5Cache` 参数；手册指出 Creator CLI 仍需要 GUI 环境。构建面板手册说明构建选项可用于命令行，且重新构建可能覆盖既有输出，因此本合同给每次构建分配此前不存在的专用目录。[命令行发布项目](https://docs.cocos.com/creator/2.4/manual/zh/publish/publish-in-command-line.html)、[构建发布面板](https://docs.cocos.com/creator/2.4/manual/zh/editor/publish/build-panel.html)
- 自动化测试覆盖 release 与 fingerprint 重验、唯一路径、Creator 版本检查、无 shell 调用、standalone/pack 两种导入 JSON、Creator 2.4 UUID 编码、资源 UUID 和磁盘文件核对、错误进程持久化、Host 中断后只读对账及内容修改拒绝。
- 2026-10-08，Creator 2.4.15 图形构建面板以 `Web Mobile` 构建实际 `2.4.15NewProject`，状态 `completed`；隔离输出 `build/cocos-agent/web-real-ui-01` 的 `web-mobile/assets/resources/config.f54dc.json` 通过 Host 输出校验，红蓝 Texture2D 的 UUID、pack 导入 JSON 和 native PNG 均匹配。[实机包轨迹](traces/cocos-agent-content-build-2.4-gui-output.jsonl)。这验证了输出格式与解析器，不代表 `content.build.execute` CLI 接线成功，也不代表包已部署或运行。
- 随后仅将该 `web-mobile` 目录通过绑定 `127.0.0.1` 的静态文件服务打开。浏览器标题为 `Cocos Creator | hello_world`，访问树出现 `GameCanvas`，截图可见 Hello World 场景；服务停止后本地构建包仍保留。[浏览器预览观察](traces/cocos-agent-content-build-2.4-browser-preview.jsonl)。这证明当前构建产物能在本机浏览器启动并渲染示例场景；没有证明已选版本里的红蓝纹理被场景动态加载、远端部署或移动设备运行。
- 后续在同一实际 Web-Mobile 包上启动正常 2.4 运行时通道，Host 为构建预览显式绑定 `http://127.0.0.1:50466/` Origin。场景启动后蓝纹理回执 `applied`；选择红版本后构建包显示红色并回执 `applied`；调用 `content.rollback` 后恢复蓝色并更新 `effective`。完整回执见[构建包运行时轨迹](traces/cocos-agent-content-build-2.4-runtime-web.jsonl)。本次临时红版本记录已移除，测试前的 `selected.json` 已恢复；实际蓝版 `effective` 观测保留。此结果覆盖本机内置资源包的运行时替换，不代表远端分发、移动设备、原生构建或正式发布。
- CLI 仍有明确缺口：一次发生于锁屏时，一次发生于桌面可交互且 Creator 窗口打开时，直接启动 Creator 可执行文件都在 macOS `RegisterApplication` 阶段以 `SIGABRT` 退出且没有产物；`open -n -W` 包装方式返回 `kLSNoExecutableErr`。见[CLI 尝试轨迹](traces/cocos-agent-content-build-2.4-cli-attempt.jsonl)。这只界定当前 Host 启动上下文的限制，不证明 Creator 的构建参数无效；CLI 执行与 Host 持久回执仍需在可访问 WindowServer 的 Host 进程环境验收。
- 官网的 API 边界也没有提供可直接从扩展调用的公开构建启动方法：`Editor.Builder` 页面只列事件订阅/移除和构建完成等事件；旧版 IPC 文档将 `editor:build-start/finished` 标为不建议使用，列出的 `builder:query-build-options` 仅用于查询。下一步应在可访问 WindowServer 的 Host/Agent 进程环境解决官方 CLI 启动及回执；不猜测未文档化的 IPC 写入命令。[Editor.Builder API](https://docs.cocos.com/creator/2.4/manual/zh/extension/api/editor-framework/main/builder.html)、[常用 IPC 消息](https://docs.cocos.com/creator/2.4/manual/zh/extension/reference/ipc-reference.html)

本合同当前验收“当前选中的内容版本进入 Web 构建包”、本机浏览器启动该包以及带有一次性本地会话参数时的红蓝运行时切换和回滚。`content.build.execute` 还没有自动编排静态服务、Host 启动及会话 URL；远端部署和发布也仍是后续工作。
