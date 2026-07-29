# Creator 编辑器桥

## 目标

Creator Bridge 是安装在 Cocos Creator 2.4.15 项目 `packages/` 中的扩展，用于把稳定、受限的
编辑器能力暴露给本地 CocosAgent。它不是通用远程控制服务。

## 扩展形态

基于 Creator 2.4.15 package 机制：

```text
creator-extension/cocos-agent-bridge/
├── package.json
├── main.js
├── scene-script.js
├── lib/
│   ├── schema.js
│   ├── session.js
│   └── result.js
└── panel/
    └── index.js
```

`package.json` 注册 `main.js`、可选面板和 IPC message。主进程能力通过 `Editor.Ipc` 调度，
场景对象操作通过 Scene Script 执行。

## 连接模型

首选方案是 Bridge 在 `127.0.0.1` 上启动随机可用端口，由扩展生成一次性会话描述：

```json
{
  "protocol": 1,
  "projectId": "677cf605-b5c7-4309-9de7-5ca0efb977f2",
  "creatorVersion": "2.4.15",
  "port": 43127,
  "sessionId": "random-id",
  "expiresAt": "2026-08-01T10:00:00.000Z"
}
```

会话文件写入项目本机状态目录，而不是 `assets/`。会话密钥只存在于进程内或权限受限的临时文件中。

## 安全要求

- 仅监听 `127.0.0.1`，不监听 `0.0.0.0`。
- 每个请求校验 session token、项目 ID、协议版本和过期时间。
- 校验 `Origin`；不接受任意网页跨域调用。
- 请求体限制为 1 MB，响应体默认限制为 2 MB。
- 命令采用固定枚举，不接受任意函数名、文件路径或 JavaScript 代码。
- 所有路径转换为 `db://assets/...` 或经项目根目录校验的相对路径。
- Bridge unload 时关闭端口并清除会话。

## 请求协议

```ts
type BridgeRequest<T> = {
  protocol: 1;
  requestId: string;
  sessionId: string;
  projectId: string;
  command: BridgeCommand;
  params: T;
};

type BridgeResponse<T> = {
  requestId: string;
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  durationMs: number;
};
```

## 首期命令

| 命令 | 执行位置 | 说明 |
|---|---|---|
| `system.ping` | Main | 版本和能力协商 |
| `project.describe` | Main | 项目、AssetDB 和当前场景摘要 |
| `asset.query` | Main | 按 URL、UUID、类型查询资源 |
| `asset.refresh` | Main | 刷新指定 `db://assets` 路径 |
| `scene.tree` | Scene | 返回有界节点树 |
| `scene.node.create` | Scene | 在指定父节点下创建节点 |
| `scene.node.remove` | Scene | 删除节点，高风险 |
| `scene.component.add` | Scene | 挂载白名单组件 |
| `scene.property.set` | Scene | 修改白名单属性 |
| `scene.save` | Main/Scene | 保存当前场景 |
| `editor.logs` | Main | 获取有界日志摘要 |
| `build.start` | Main | 启动受支持平台构建 |
| `build.status` | Main | 查询构建状态 |

## 能力协商

`system.ping` 返回：

```json
{
  "bridgeVersion": "0.1.0",
  "protocol": 1,
  "creatorVersion": "2.4.15",
  "projectId": "...",
  "capabilities": [
    "asset.query",
    "scene.tree",
    "scene.node.create",
    "scene.component.add",
    "scene.property.set",
    "scene.save"
  ]
}
```

版本或能力不匹配时，Agent 必须降级为只读文件分析，不猜测命令是否可用。

## 并发与取消

- Scene 写命令串行执行。
- 只读查询最多并发 4 个。
- 每个请求都有超时；默认查询 10 秒、保存 30 秒、构建单独管理。
- Agent 取消后停止等待并发送 `request.cancel`；无法安全终止的编辑器操作必须完成后报告。
- 同一个 `requestId` 重试时应具备幂等语义，或明确返回不可重试。

## 日志与审计

Bridge 日志只记录命令名、目标摘要、耗时和错误码，不记录 API Key、完整脚本、完整场景或会话密钥。
