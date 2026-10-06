# CocosAgent 本地通信原型

此原型验证 Agent 本地服务与 Creator 版本专属扩展之间的 WebSocket 会话，不调用 LLM，也不修改场景或资源。

## 已实现的协议步骤

1. Agent 服务仅绑定 `127.0.0.1`，选择系统分配的端口。
2. Agent 写入项目 `temp/cocos-agent-bridge/session.json`，包含协议版本、项目路径、Creator 版本、会话地址和随机令牌。该目录由 Creator 忽略；文件权限设为当前用户可读写。
3. 对应版本的扩展读取本项目会话文件，检查项目路径、Creator 版本、协议版本和有效期，然后连接本机服务。
4. 扩展发送 `hello`；Agent 校验项目、Creator 版本、扩展名和协议版本。
5. Agent 发送固定 `bridge.ping` 请求；扩展回传 nonce、Creator 版本和项目路径。Agent 核对回包后退出并清理会话文件。

Agent key 不参与此流程，也不会写入项目。WebSocket 会话令牌只用于本机桥接认证。

## 启动

先确保对应 Creator 工程已打开并启用 `cocos-agent-bridge` 扩展，然后在仓库根目录运行对应命令：

```sh
node tools/cocos-agent-bridge/bridge-host.js \
  --project "$PWD/3.8,7NewProject" \
  --creator-version 3.8.7
```

```sh
node tools/cocos-agent-bridge/bridge-host.js \
  --project "$PWD/2.4.15NewProject" \
  --creator-version 2.4.15
```

启动后，服务等待最多 15 秒完成握手，随后发送一次 ping 并验证响应。2.4 新增 `packages/` 扩展后需重开工程；3.8 可在扩展管理器刷新并启用项目扩展。

## 扩展与依赖

- 2.4 入口：`2.4.15NewProject/packages/cocos-agent-bridge/main.js`
- 3.8 入口：`3.8,7NewProject/extensions/cocos-agent-bridge/dist/main.js`
- Agent 服务：`tools/cocos-agent-bridge/bridge-host.js`
- 为支持当前无 npm 网络的环境，原型固定使用 `ws` 7.5.10；上游 MIT 许可证和源码保存在 `vendor/ws/`。发布产品前应评估升级到受支持版本。

## 验证边界

2026-10-06，Creator 2.4.15 与 3.8.7 都完成：本机连接、版本与项目握手、Agent 发起 `bridge.ping`、扩展回显 nonce、Agent 校验并清理会话。轨迹见 `docs/agent-foundation/traces/cocos-agent-bridge-0.1.jsonl`。

此原型未验证 Agent 到编辑器内部场景/资源 API 的调用，也没有重试持久化、断线恢复、进度推送、取消、并行项目隔离或正式安全审查。下一步再把一个只读编辑器能力加入固定 RPC 清单，然后进入 PNG 导入纵向用例。
