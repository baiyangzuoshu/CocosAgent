# 总体架构

## 系统视图

```text
开发者
  ↓
CocosAgent Desktop UI
  ↓ HTTP / NDJSON
Agent Runtime
  ├── Provider
  ├── Prompt / Context
  ├── Permission Engine
  └── Tool Registry
          ↓
      Cocos Services
      ├── Project Inspector
      ├── Asset Index
      ├── Script Service
      ├── Scene Service
      ├── Build Service
      └── Creator Bridge Client
              ↓ 127.0.0.1 + session token
      Creator 2.4.15 Extension
              ↓ Editor.Ipc / Scene Script / AssetDB
      Scene、Prefab、Node、Component、Preview、Build
```

## 进程边界

### CocosAgent 进程

负责模型调用、工具循环、权限审批、项目索引、普通文件操作、Bridge 请求、事件流和持久化。
它不得直接依赖 Creator 内部 Electron 运行时。

### Creator 编辑器进程

加载项目内 `packages/cocos-agent-bridge/` 扩展。扩展只暴露经过验证的命令，不执行模型生成的任意
JavaScript，不返回大文件全文。

### Creator 预览或构建进程

由编辑器或受控命令启动。Agent 负责超时、取消、日志截断和子进程清理。

## 建议源码结构

```text
CocosAgent/
├── src/
│   ├── mod.ts
│   ├── runtime.ts
│   ├── permissions.ts
│   ├── registry.ts
│   ├── features/
│   │   └── cocos.ts
│   └── cocos/
│       ├── contracts.ts
│       ├── project.ts
│       ├── indexer.ts
│       ├── scripts.ts
│       ├── scene.ts
│       ├── assets.ts
│       ├── build.ts
│       ├── bridge_client.ts
│       └── validation.ts
├── desktop/
├── creator-extension/
│   └── cocos-agent-bridge/
├── fixtures/
├── docs/
├── engine2.4.15/
└── cocos-2.4.15-demo/
```

## 数据流

以“给 Canvas 新增 Label”为例：

1. Runtime 获取用户请求并生成只读检查计划。
2. `cocos_project_inspect` 确认版本和当前工作区。
3. `cocos_scene_get_tree` 通过 Bridge 获取当前场景摘要。
4. Agent 生成结构化操作，不生成序列化 JSON 补丁。
5. Permission Engine 展示目标节点、操作和风险。
6. Bridge 校验会话、项目根目录、命令 schema 和目标节点。
7. Scene Script 创建节点和组件，保存场景。
8. Agent 重新读取节点树、日志和资源状态。
9. UI 展示结果、变更文件和验证结论。

## 关键边界

- Runtime 只有一个主工具循环，Cocos Feature 不能建立平行 Agent Loop。
- Bridge 请求必须携带 `requestId`、`sessionId`、`projectId` 和超时。
- 所有路径在执行时解析真实路径并限制在活动项目内。
- Bridge 不接受 Shell 命令、不接受任意模块路径、不接受可执行源代码。
- 工具输出默认返回摘要、ID、路径和计数；详细结构按需分页。
- 取消信号必须传递到模型、工具、Bridge 和构建进程。

## 状态与持久化

持久化内容：

- 已授权工作区与 Creator 安装路径。
- Bridge 会话元数据，不持久化明文会话密钥。
- 项目索引缓存及其文件时间戳。
- 工具审计事件和最近验证结果。

不持久化：

- API Key 明文。
- 完整用户项目副本。
- `library/`、`temp/` 和 Creator 内部缓存。
- 未经裁剪的长期控制台日志。
