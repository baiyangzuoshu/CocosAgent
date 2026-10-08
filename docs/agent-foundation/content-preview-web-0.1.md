# CocosAgent 本机 Web-Mobile 预览合同 0.1

本合同只覆盖 Cocos Creator 2.4.15 的 Web-Mobile 构建。它把已验收的构建包作为只读静态文件服务，并与现有本机运行时 Host 建立会话；不会启动 Creator 构建，也不会修改场景或构建产物。

## 调用流程

请求通过长期运行的 `node tools/cocos-agent-bridge/agent-jsonl.js` 逐行发送。预览服务状态保存在该 Agent 进程内；stdin 关闭或进程退出时会清理活动服务。

1. 调用 `content.build.get`，确认 `state: "completed"`。
2. 调用 `content.preview.start`，输入 `projectRoot`、`creatorVersion: "2.4.15"` 和 `buildId`。
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
- 启动前重验记录中的 release manifest 和 Web-Mobile 资源包；包内必须有与 resources 配置同属一个目录树的 `index.html`。
- 当前 selected release 的 ID 与 fingerprint 必须和构建记录相同，且当前项目资源重新校验通过。若内容版本已切换，返回 `BUILD_RELEASE_NOT_SELECTED`，应先恢复构建时版本或重新构建。
- 静态服务器和运行时 Host 均只绑定 `127.0.0.1` 的临时端口。静态服务只响应 GET/HEAD，不列目录，不允许路径逃逸或跟随指向包外的符号链接。
- `previewUrl` 包含运行时 Host 临时令牌。只在本机预览时使用，不应贴到公共日志、远端浏览器或可分享链接。
- `get/stop` 查找当前 Agent 进程中的会话。重启后旧会话不存在；进程退出会释放监听端口。

`runtime-observed` 表示运行时 Host 收到了已认证客户端的资源应用回执，并接受了 `content.runtime.accept`。没有浏览器打开时状态会保持 `waiting-for-runtime`；该合同不会自动启动浏览器或模拟用户验收。

## 错误状态

| 错误 | 含义 |
| --- | --- |
| `BUILD_NOT_COMPLETED` | 构建状态不是已验收的 `completed` |
| `BUILD_RECORD_MISMATCH` | buildId、版本、项目或隔离输出路径与记录不一致 |
| `BUILD_OUTPUT_CHANGED` | 重新扫描的包不再匹配构建记录 |
| `BUILD_RELEASE_NOT_SELECTED` | 当前选中内容版本不是构建所用版本 |
| `BUILD_RELEASE_CHANGED` | 构建 release 或源资源的当前指纹校验失败 |
| `PREVIEW_ENTRY_NOT_FOUND` | 不能把已校验 resources bundle 对应到安全的 Web 入口 |
| `PREVIEW_START_FAILED` | loopback 静态服务或运行时 Host 启动失败 |
| `PREVIEW_NOT_FOUND` | 此 Agent 进程没有该活动预览；`stop` 对已停止会话幂等成功 |

## 验收范围

单元集成测试覆盖构建记录拒绝、release 漂移拒绝、静态资源服务、路径/方法限制、运行时状态读取及关闭。2026-10-09，本机 `web-host-cli-01` 实际构建包启动预览，浏览器画面显示蓝色方块和 Hello World；Host 收到蓝色资源 `applied`、引用数为 1 的回执，并接受为 `runtime-observed`。随后显式停止 Host 和静态服务器并关闭标签页；完整记录见 [`预览轨迹`](traces/cocos-agent-content-preview-2.4.jsonl)。

这不是远程部署或原生启动服务；也不负责构建。Web-Mobile 静态资源服务和运行时 Host 由显式 `content.preview.start` 启动，Agent 调用方负责打开返回 URL。
