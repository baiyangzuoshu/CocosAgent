# Creator 2.4 Web-Mobile 内容构建合同 0.1

此切片把已选中的 `built-in-resources` 内容版本交给 Creator 2.4.15 构建成 Web-Mobile 包，并核对输出是否包含清单中每张 Texture2D。它只支持 2.4.15 与 `web-mobile`；不处理 Creator 3.8、Asset Bundle、原生包、远端发布或热更新。

## 方法

| 方法 | 输入 | 行为 |
| --- | --- | --- |
| `content.build.plan` | `projectRoot`、`creatorVersion: "2.4.15"`、`releaseId`、`expectedFingerprint`、`buildId` | 只读重验当前 selected release、PNG 字节、meta UUID 和 Creator 安装版本；生成隔离输出路径及 CLI 参数 |
| `content.build.execute` | 与 plan 相同 | 先原子占用 buildId，再以参数数组启动 Creator 命令行构建；成功后扫描 Web 包并逐项核对 resources 配置、压缩 UUID、import JSON 与 PNG native 文件 |
| `content.build.get` | `projectRoot`、`creatorVersion`、`buildId` | 读取 `.cocos-agent/content-builds/<buildId>.json` 的持久结果 |
| `content.build.reconcile` | 与 get 相同 | 对 Host 中断后仍为 `running` 或 `needs-review` 的记录，只读校验已有包；不重启 Creator、不重做构建 |

`buildId` 只允许小写字母、数字和连字符，长度 3–32。输出被固定派生到 `build/cocos-agent/<buildId>`，要求此前不存在；冲突会拒绝构建，不清空或覆盖旧输出。CLI 不经过 shell。Creator 版本从应用包 `Info.plist` 核验；默认查找 `/Applications/Cocos/Creator/2.4.15/CocosCreator.app`，也可通过 `COCOS_CREATOR_2_4_15_EXECUTABLE` 指向 Creator 2.4.15 应用包内的可执行文件。构建最多等待 20 分钟。

请求 schema 见 [`content-build.schema.json`](../../tools/cocos-agent-bridge/content-build.schema.json)。

Host 仅在 Creator 进程以成功状态退出后检查产物；还须找到 Web `index.html` 与 `name: "resources"` 的 bundle 配置。每个资源需同时满足：路径项等于 release 的 `runtimePath`、type 为 `cc.Texture2D`、UUID 与 2.4 压缩 UUID 一致，并且导入 JSON 和 PNG native 文件均存在于此输出包中。Creator 命令退出成功但任何资源缺失时，operation 为 `needs-review`，不会报告构建验收成功。失败输出保留用于诊断；应使用新 buildId 重试。

示例调用顺序：

```json
{"id":1,"method":"content.build.plan","params":{"projectRoot":"/absolute/project","creatorVersion":"2.4.15","releaseId":"sample-release","expectedFingerprint":"<64-char-fingerprint>","buildId":"web-smoke-01"}}
{"id":2,"method":"content.build.execute","params":{"projectRoot":"/absolute/project","creatorVersion":"2.4.15","releaseId":"sample-release","expectedFingerprint":"<64-char-fingerprint>","buildId":"web-smoke-01"}}
{"id":3,"method":"content.build.get","params":{"projectRoot":"/absolute/project","creatorVersion":"2.4.15","buildId":"web-smoke-01"}}
{"id":4,"method":"content.build.reconcile","params":{"projectRoot":"/absolute/project","creatorVersion":"2.4.15","buildId":"web-smoke-01"}}
```

## 证据状态

- 2.4 官方命令行发布手册确认 `--path`、`--build`、`platform`、`buildPath` 和 `md5Cache` 参数；手册指出 Creator CLI 仍需要 GUI 环境。构建面板手册说明构建选项可用于命令行，且重新构建可能覆盖既有输出，因此本合同给每次构建分配此前不存在的专用目录。[命令行发布项目](https://docs.cocos.com/creator/2.4/manual/zh/publish/publish-in-command-line.html)、[构建发布面板](https://docs.cocos.com/creator/2.4/manual/zh/editor/publish/build-panel.html)
- 自动化测试覆盖 release 与 fingerprint 重验、唯一路径、Creator 版本检查、无 shell 调用、资源 UUID 和磁盘文件核对、错误进程持久化、Host 中断后只读对账及内容修改拒绝。
- **真实 Creator Web-Mobile 构建尚未验证。**当前输出目录格式与 UUID 对账有隔离夹具测试；它们不是 Creator 产物证据。需要 Creator 可交互的 GUI 环境完成首次构建，并保留实际包内 config/UUID/资源路径轨迹后，才可把本 skill 标为实机验证。

本合同只验收“当前选中的内容版本进入 Web 构建包”。它不证明构建包已经部署、托管或在浏览器打开运行；发布预览与部署验收需要后续切片。
