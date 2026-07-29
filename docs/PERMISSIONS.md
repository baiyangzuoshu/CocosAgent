# 权限模型

## 模式

沿用三种权限模式：

- `ask`：变更、外部影响和危险操作逐次审批。
- `auto`：自动允许普通工作区内操作，但不绕过路径和危险检查。
- `full`：仅由用户明确选择后启用，仍保留硬拒绝和审计。

## Cocos 操作分类

| 操作 | 分类 | `ask` | `auto` |
|---|---|---|---|
| 识别项目、列出资源 | 只读 | 允许 | 允许 |
| 读取节点树和日志 | 只读 | 允许 | 允许 |
| 创建或修改普通脚本 | 变更 | 审批 | 工作区内允许 |
| 创建节点、挂载组件、设置属性 | 变更 | 审批 | 白名单操作允许 |
| 保存场景 | 变更 | 随所属事务审批 | 白名单操作允许 |
| 导入资源 | 变更 | 审批 | 工作区内允许 |
| 启动预览、构建 | 外部影响 | 审批 | 允许但必须受控 |
| 删除节点、组件或资源 | 危险 | 强确认 | 强确认 |
| 修改 `.fire`/`.prefab`/`.meta` 原文 | 危险 | 默认拒绝 | 拒绝 |
| 修改 `engine2.4.15/` | 危险 | 默认拒绝 | 拒绝 |
| Bridge 监听非回环地址 | 硬拒绝 | 拒绝 | 拒绝 |

## 审批内容

审批卡必须包含：

- 操作名称。
- 项目和场景。
- 精确目标路径或节点路径。
- 预计新增、修改或删除内容。
- 是否会启动进程、构建或刷新 AssetDB。
- 恢复方案。

不允许只显示“执行 Cocos 操作”这类模糊描述。

## 路径规则

- 执行时调用 `realPath`，防止符号链接逃逸。
- 普通写操作必须位于活动项目根目录。
- 脚本和资源写操作默认限制在 `assets/`。
- Bridge 安装仅允许写入 `packages/cocos-agent-bridge/`。
- 构建输出必须位于工作区内的显式目录。
- `engine2.4.15/` 默认标记为只读保护根。

## 硬拒绝

无论权限模式如何都拒绝：

- Bridge 执行任意源码或 Shell 字符串。
- 将 token、API Key 或项目文件上传到未授权服务。
- 监听公网或局域网地址。
- 未解析目标的递归删除。
- 越过活动项目根目录写文件。
- 在取消后遗留由 Agent 启动的子进程。

## 审计事件

每个工具事件记录：

```ts
type CocosAuditEvent = {
  timestamp: string;
  requestId: string;
  tool: string;
  classification: "read" | "mutating" | "external" | "dangerous";
  projectId: string;
  target?: string;
  approvedBy: "policy" | "user";
  outcome: "success" | "failure" | "cancelled" | "indeterminate";
  changedPaths?: string[];
};
```

审计数据不得包含完整凭据、完整场景内容或无界日志。
