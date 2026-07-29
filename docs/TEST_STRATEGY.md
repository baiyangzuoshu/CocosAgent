# 测试策略

## 测试目标

验证 CocosAgent 不仅“能调用工具”，还能够在 Creator 2.4.15 中产生可保存、可重新加载、可回滚的
正确结果。

## Fixture 项目

固定使用：

```text
cocos-2.4.15-demo/
```

需要补齐：

```text
assets/
├── scenes/Main.fire
├── prefabs/TestPanel.prefab
├── scripts/TestComponent.ts
└── textures/cocos-agent-icon.png
```

基准场景：

```text
Canvas
├── Background
├── TitleLabel
├── TestButton
└── TestPanel
```

Fixture 的 `library/`、`temp/`、`local/` 和 `build/` 不进入版本控制。

## 测试层次

### 单元测试

- 项目版本识别。
- 工作区真实路径和符号链接边界。
- Asset 类型分类和分页。
- `.meta` UUID 只读解析。
- Bridge 请求与响应 schema。
- 属性白名单和数值范围。
- 权限分类。
- 日志和工具输出截断。

### Bridge 契约测试

使用假 Bridge 验证：

- 能力协商成功和版本不兼容。
- token 错误、过期和项目 ID 不匹配。
- 超时、取消、重复 request ID。
- 大请求和大响应拒绝。
- 未知命令拒绝。

### Creator 集成测试

需要真实 Creator 2.4.15：

- 扩展 load/unload。
- `system.ping`。
- AssetDB 查询和刷新。
- 当前场景树读取。
- 创建节点、挂载组件、设置属性、保存。
- Creator 编译错误采集。
- Bridge 关闭后端口释放。

### 端到端测试

任务一：项目理解

```text
打开 Fixture → 识别版本 → 列出场景和脚本 → 输出节点树
```

任务二：脚本

```text
创建 TestComponent → 等待编译 → 挂载组件 → 保存 → 重启 Creator → 验证
```

任务三：品牌图标

```text
刷新 textures/cocos-agent-icon.png → 获取 UUID → 创建 Sprite → 设置资源 → 预览
```

任务四：构建

```text
构建 Web Desktop → 验证入口文件 → 启动本地预览 → 检查控制台错误
```

## Scene/Prefab 回归

每个写测试记录：

- 修改前目标文件摘要。
- Bridge 操作列表。
- 修改后节点和组件摘要。
- Creator 控制台新增错误。
- 关闭并重开场景后的摘要。

不比较所有序列化字节；比较业务不变量：

- 节点路径存在。
- 组件类型和属性正确。
- UUID 可解析。
- Prefab 实例关系有效。
- Creator 无反序列化错误。

## 故障注入

- 写操作过程中取消请求。
- Bridge 响应超时但 Creator 已执行操作。
- AssetDB 正在刷新。
- 场景存在未保存人工修改。
- 脚本编译失败。
- 目标节点在审批后被人工删除。
- 构建进程失败或超时。
- Bridge 意外卸载。

预期结果是停止自动执行、重新查询状态，并报告 `failure` 或 `indeterminate`，不能盲目重试。

## 性能与边界

- 10,000 个资源时索引输出仍保持分页。
- 500 个节点时场景树不超过输出上限。
- 日志超过 10,000 行时只返回最近的有界摘要。
- Bridge 并发只读查询不超过 4，Scene 写操作始终串行。

## 人工验收

发布前在 macOS 上检查：

- Creator 路径选择和持久化。
- Bridge 安装、启用、重载和卸载。
- 场景保存与 Undo 行为。
- Web Preview。
- Web Desktop/Mobile 构建。
- 应用退出时 Bridge 请求和子进程清理。
- 权限卡信息是否足以让开发者判断风险。
