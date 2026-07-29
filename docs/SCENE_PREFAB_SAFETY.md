# Scene 与 Prefab 安全策略

## 风险

Creator 2.4.15 的 `.fire` 和 `.prefab` 是对象图序列化数据。直接文本改写可能破坏：

- `__id__` 对象索引。
- UUID 和 `.meta` 引用。
- 节点、组件和 Prefab 实例关系。
- 编辑器版本特定字段。
- 尚未保存的内存场景状态。

因此它们不能按普通 JSON 文件处理。

## 修改优先级

1. **Creator Scene Script / Editor API**：首选，适用于节点和组件操作。
2. **AssetDB API**：适用于资源导入、移动、刷新和 UUID 查询。
3. **专用结构化转换器**：仅用于已覆盖的离线操作，并必须有 Fixture 测试。
4. **通用文件编辑工具**：默认禁止写入 `.fire`、`.prefab` 和 `.meta`。

## 操作事务

每个 Scene 或 Prefab 写操作遵循：

```text
前置检查
→ 读取场景状态
→ 生成操作预览
→ 权限审批
→ 创建恢复点
→ 通过 Bridge 修改
→ 保存
→ 重新读取
→ 验证
→ 成功确认或回滚
```

恢复点可以使用：

- Git 工作树中的未提交差异记录。
- 目标文件的工作区内临时备份。
- Creator Undo（只能作为辅助，不能作为唯一恢复机制）。

备份文件不得放入 `assets/`，避免被 AssetDB 导入。

## 白名单属性

首期允许直接设置：

- Node：`name`、`active`、`x`、`y`、`width`、`height`、`angle`、`scaleX`、`scaleY`。
- Label：`string`、`fontSize`、`lineHeight`、`horizontalAlign`、`verticalAlign`。
- Sprite：已经由 AssetDB 返回的 `spriteFrame` UUID 引用。
- Button：基础交互状态；事件数组单独设计，不接受任意 handler。
- Widget/Layout：经过范围校验的布局属性。
- 自定义组件：仅编辑 Creator 能反射出的序列化属性。

首期禁止：

- 修改内部 `__id__`、`__type__` 和保留字段。
- 手写 UUID。
- 直接更改 Prefab 内部同步标记。
- 设置函数、原型、脚本源码或任意表达式作为属性值。

## 删除规则

删除节点、组件、Prefab 或资源属于高风险操作：

- 必须明确列出目标和引用计数。
- 默认使用 Creator API。
- 删除资源前查询依赖。
- 不允许名称模糊匹配后的批量删除。
- 未保存场景存在时必须先由用户选择保存、放弃或取消。

## 验证

写操作后至少执行：

- Bridge 能重新读取目标节点或组件。
- Creator 控制台没有新增编译或反序列化错误。
- 场景保存完成且文件存在。
- AssetDB 刷新结束。
- 新增资源 UUID 可解析。

高风险操作还应：

- 关闭并重新打开场景。
- 对比关键节点路径和组件数量。
- 运行 Web Preview。

## 并发

- 同一场景只允许一个写事务。
- AssetDB 刷新期间不启动 Scene 写事务。
- 构建期间默认禁止资源移动和删除。
- Agent Team 不得并行修改同一 Scene 或 Prefab。

## 故障处理

Bridge 超时不能直接判定操作未执行。Agent 必须重新查询场景状态，再决定重试或回滚。任何无法确认的
写操作都标记为 `indeterminate` 并停止后续自动变更。
