# CocosAgent 本机 Web-Mobile 预览合同 0.1

本合同只覆盖 Cocos Creator 2.4.15 的 Web-Mobile 构建。它把已验收的构建包作为只读静态文件服务，并与现有本机运行时 Host 建立会话；不会启动 Creator 构建，也不会修改场景或构建产物。

## 调用流程

请求通过长期运行的 `node tools/cocos-agent-bridge/agent-jsonl.js` 逐行发送。预览服务状态保存在该 Agent 进程内；stdin 关闭或进程退出时会清理活动服务。

1. 调用 `content.build.get`，确认 `state: "completed"`。
2. 调用 `content.preview.start`，输入 `projectRoot`、`creatorVersion: "2.4.15"` 和 `buildId`。启动时必须选中构建所使用的 release。
3. Agent 返回 `previewUrl`。在本机浏览器打开此 URL，运行时会通过一次性令牌连接 Host。
4. 调用 `content.preview.get` 读取 `waiting-for-runtime`、`connected`、`runtime-observed` 或 `needs-review` 状态及最近回执。
5. 调用 `content.preview.stop` 关闭 WebSocket Host 和静态服务。

请求结构见 [`content-preview.schema.json`](../../tools/cocos-agent-bridge/content-preview.schema.json)。`start` 对相同项目与 buildId 幂等；一个 Agent 进程可同时预览不同项目或构建。

```jsonl
{"id":1,"method":"content.preview.start","params":{"projectRoot":"/absolute/project","creatorVersion":"2.4.15","buildId":"web-host-cli-01"}}
{"id":2,"method":"content.preview.get","params":{"projectRoot":"/absolute/project","creatorVersion":"2.4.15","buildId":"web-host-cli-01"}}
{"id":3,"method":"content.preview.stop","params":{"projectRoot":"/absolute/project","creatorVersion":"2.4.15","buildId":"web-host-cli-01"}}
```

## 启动前校验与访问边界

- build 记录必须属于同一项目、2.4.15、相同 buildId，状态必须为 `completed`，输出路径必须严格等于 `build/cocos-agent/<buildId>`。
- 启动前重验记录中的 release manifest 和 Web-Mobile 资源包；包内必须有与内容 Bundle 配置同属一个目录树的 `index.html`。
- 启动时当前 selected release 的 ID 与 fingerprint 必须和构建记录相同，且当前项目资源重新校验通过。若启动前内容版本已切换，返回 `BUILD_RELEASE_NOT_SELECTED`，应先恢复构建时版本或重新构建。预览启动后，显式变更 selected release 会经同一运行时 Host 推送新内容。
- 静态服务器和运行时 Host 均只绑定 `127.0.0.1` 的临时端口。静态服务只响应 GET/HEAD，不列目录，不允许路径逃逸或跟随指向包外的符号链接。
- `previewUrl` 包含运行时 Host 临时令牌。只在本机预览时使用，不应贴到公共日志、远端浏览器或可分享链接。
- `get/stop` 查找当前 Agent 进程中的会话。进程退出会释放监听端口，旧 URL 的会话令牌随之失效。新 Host 可用原 `projectRoot/buildId` 重新校验持久构建与 release 记录并创建会话；浏览器须打开新返回的 `previewUrl`，运行时随后会再次应用持久 selected release。

`runtime-observed` 表示运行时 Host 收到了已认证客户端的资源应用回执，并接受了 `content.runtime.accept`。没有浏览器打开时状态会保持 `waiting-for-runtime`；该合同不会自动启动浏览器或模拟用户验收。

`content.preview.get` 返回 `buildReleaseId`（此包构建自哪个 release）、`selectedReleaseId`（当前 Host 指针）和 `effectiveReleaseId`（本次会话已收到的运行时回执）。运行中的 rollback 后，这三个字段可能不同，应分别读取，不要把构建来源当作运行时当前版本。新会话在收到回执前 `effectiveReleaseId` 为空；`recovery.previousAcceptedReleaseId` 只表示磁盘上上次被 Host 接受的记录，不能证明新运行时已恢复。`recovery.state` 为 `awaiting-runtime` / `awaiting-receipt` 时等待打开新 URL 和运行时重放，接受当前会话回执后为 `confirmed`；失败时为 `needs-review`。

## 错误状态

| 错误 | 含义 |
| --- | --- |
| `BUILD_NOT_COMPLETED` | 构建状态不是已验收的 `completed` |
| `BUILD_RECORD_MISMATCH` | buildId、版本、项目或隔离输出路径与记录不一致 |
| `BUILD_OUTPUT_CHANGED` | 重新扫描的包不再匹配构建记录 |
| `BUILD_RELEASE_NOT_SELECTED` | 当前选中内容版本不是构建所用版本 |
| `BUILD_RELEASE_CHANGED` | 构建 release 或源资源的当前指纹校验失败 |
| `PREVIEW_ENTRY_NOT_FOUND` | 不能把已校验内容 Bundle 对应到安全的 Web 入口 |
| `PREVIEW_START_FAILED` | loopback 静态服务或运行时 Host 启动失败 |
| `PREVIEW_NOT_FOUND` | 此 Agent 进程没有该活动预览；`stop` 对已停止会话幂等成功 |

## 验收范围

单元集成测试覆盖构建记录拒绝、release 漂移拒绝、静态资源服务、路径/方法限制、构建/selected/effective 状态分别读取、恢复状态和关闭。2026-10-09，本机 `web-host-cli-01` 实际构建包启动预览，浏览器画面显示蓝色方块和 Hello World；Host 收到蓝色资源 `applied`、引用数为 1 的回执，并接受为 `runtime-observed`。随后重启 JSONL Host，从同一持久 build/release 记录创建新预览，打开新 URL 后游戏重新应用蓝色资源；新 Host 再次收到匹配 UUID、引用数为 1 的 `applied` 回执，`recovery.state` 从 `awaiting-runtime` 转为 `confirmed`。测试仅覆盖 Creator 2.4.15 Web-Mobile 内置 `resources` release，不代表 Asset Bundle、原生或未重新加载浏览器页时可恢复；记录见 [`Host 重启恢复轨迹`](traces/cocos-agent-content-preview-restart-2.4-web.jsonl)。

同日继续从已验收的场景流水线生成 `cocosagent-p1-20261009`，构建并打开 `p1-web-20261009`。Host 收到蓝色入口资源的 `applied` 回执并确认 `runtime-observed`；浏览器同时显示场景红、蓝 Sprite 与运行时蓝色 Sprite。执行 `content.rollback` 后打开原 `web-host-cli-01`，Host 对旧 release 的蓝色资源再次收到 `applied`，`effective` 回到旧指纹，浏览器显示蓝色方块和 Hello World。完整操作序列见[发布、构建和回滚轨迹](traces/cocos-agent-p1-release-build-2.4-web.jsonl)。

这不是远程部署或原生启动服务；也不负责构建。Web-Mobile 静态资源服务和运行时 Host 由显式 `content.preview.start` 启动，Agent 调用方负责打开返回 URL。

Asset Bundle 的 Host 流程另见[Bundle 内容合同](content-bundle-web-0.1.md)与[实机轨迹](traces/cocos-agent-asset-bundle-host-2.4-web.jsonl)：在同一个活动预览中实测了 Bundle 应用、旧 resources release 回滚、临时缺失 Bundle native PNG 时保留旧画面、恢复文件后的显式重选和最终回滚。
