# Agent 工具设计

## 设计规则

- Cocos 工具通过 `ToolRegistry` 注册，并组成可移除的 `CocosFeature`。
- 每个工具有明确的输入 schema、输出上限、权限分类和取消信号。
- 工具只接受结构化参数，不接受自然语言命令或任意 JavaScript。
- 写工具执行前返回可读的目标和预期变化，执行后返回验证摘要。

## MVP 工具清单

### `cocos_project_inspect`

读取项目版本、目录和 Bridge 状态。

```ts
input: { workspace?: string }
output: {
  projectId: string;
  name: string;
  creatorVersion: string;
  bridgeState: string;
  counts: { scenes: number; prefabs: number; scripts: number; assets: number };
  warnings: string[];
}
```

权限：只读。

### `cocos_assets_list`

分页列出项目资源。

```ts
input: {
  kind?: "scene" | "prefab" | "script" | "texture" | "audio" | "animation";
  prefix?: string;
  cursor?: string;
  limit?: number;
}
```

权限：只读。`limit` 最大 200。

### `cocos_scene_get_tree`

读取当前或指定场景的有界节点树。

```ts
input: {
  sceneUrl?: string;
  maxDepth?: number;
  includeProperties?: boolean;
}
```

权限：只读。首期不自动切换场景；目标场景未打开时返回明确错误。

### `cocos_node_create`

```ts
input: {
  parentPath: string;
  name: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}
```

权限：变更。节点名、路径、数值范围必须校验。

### `cocos_component_add`

```ts
input: {
  nodePath: string;
  componentType: string;
}
```

权限：变更。首期白名单包括 `cc.Label`、`cc.Sprite`、`cc.Button`、`cc.Layout`、
`cc.Widget` 和已成功编译的项目脚本组件。

### `cocos_property_set`

```ts
input: {
  nodePath: string;
  componentType?: string;
  property: string;
  value: unknown;
}
```

权限：变更。属性必须按组件类型进入白名单并做运行时验证。

### `cocos_script_create` / `cocos_script_edit`

创建或修改 `assets/` 下脚本。复用通用文件编辑能力，但增加：

- 目标必须在 `assets/` 内。
- 扩展名限 `.ts` 或 `.js`。
- 修改后等待 Creator 编译。
- 返回编译日志，不把完整日志注入模型。

权限：变更。

### `cocos_asset_import`

将工作区内或经用户明确选择的文件复制到 `assets/`，然后要求 AssetDB 刷新并返回 UUID。

权限：变更；从工作区外导入属于外部读取，需要单独审批。

### `cocos_scene_save`

保存当前场景并等待磁盘稳定。

权限：变更。必须报告实际改变的文件。

### `cocos_logs_read`

返回 Creator 最近日志的分级摘要。

```ts
input: { level?: "error" | "warn" | "info"; since?: string; limit?: number }
```

权限：只读。默认 100 条，最大 500 条。

### `cocos_preview_run`

启动 Web 预览，返回本地 URL、进程状态和日志摘要。

权限：外部影响。必须支持取消和进程清理。

### `cocos_build`

```ts
input: {
  platform: "web-mobile" | "web-desktop";
  buildPath?: string;
  debug?: boolean;
}
```

权限：外部影响和变更。首期只支持 Web；构建目录必须在工作区内。

## 统一结果

```ts
type CocosToolResult<T> = {
  ok: boolean;
  summary: string;
  data?: T;
  changedPaths?: string[];
  warnings?: string[];
  verification?: {
    passed: boolean;
    checks: string[];
  };
};
```

## 后续工具

Prefab 创建/应用、动画编辑、截图视觉验证、资源依赖图、未使用资源分析和多场景批处理在 MVP 验证后加入。
