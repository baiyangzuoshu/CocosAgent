# Cocos 项目模型

## 项目判定

合法的首期工作区必须满足：

- 存在 `project.json`。
- `project.json.version` 等于 `2.4.15`。
- `project.json.engine` 等于 `cocos-creator-js`。
- 存在 `assets/`。
- 工作区真实路径可读，且不位于引擎源码目录内。

## 目录分类

| 目录或文件 | 分类 | 默认行为 |
|---|---|---|
| `assets/` | 事实源 | 可读；写操作受权限控制 |
| `settings/` | 项目配置 | 可读；有限结构化写入 |
| `project.json` | 项目标识 | 只读，除非专门迁移 |
| `packages/` | 项目扩展 | Bridge 安装和维护 |
| `library/` | 生成缓存 | 忽略，不编辑 |
| `temp/` | 生成缓存 | 忽略，不编辑 |
| `local/` | 本机状态 | 忽略，不作为项目事实 |
| `build/` | 构建产物 | 可清理或生成，但需审批 |
| `engine2.4.15/` | 引擎知识源 | 默认只读 |

## 领域对象

### Project

```ts
type CocosProject = {
  id: string;
  name: string;
  root: string;
  creatorVersion: "2.4.15";
  assetsRoot: string;
  bridgeState: "offline" | "connecting" | "ready" | "incompatible";
};
```

### Asset

```ts
type CocosAsset = {
  url: string;       // db://assets/...
  path: string;      // 工作区相对路径
  uuid?: string;
  kind: "scene" | "prefab" | "script" | "texture" | "audio" | "animation" | "other";
  metaPath?: string;
};
```

UUID 由 Creator AssetDB 管理。Agent 不自行生成、替换或复用 UUID。

### Scene、Node 与 Component

```ts
type SceneSummary = {
  uuid?: string;
  assetUrl?: string;
  name: string;
  dirty: boolean;
  roots: NodeSummary[];
};

type NodeSummary = {
  id: string;        // 编辑器会话内节点 ID，不作为永久 ID
  name: string;
  path: string;      // Canvas/TestPanel/Button
  active: boolean;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  components: ComponentSummary[];
  children?: NodeSummary[];
};

type ComponentSummary = {
  id: string;
  type: string;
  enabled?: boolean;
  properties?: Record<string, unknown>;
};
```

节点会话 ID 可能在重新打开场景后改变。需要跨会话定位时优先使用：

1. Scene asset UUID。
2. 节点层级路径。
3. 组件类型和稳定业务标识。

禁止仅依赖数组索引或临时节点 ID。

## 索引策略

项目索引分两层：

- 文件层：扫描 `assets/` 和 `.meta`，获取路径、类型、mtime 和 UUID 摘要。
- 编辑器层：通过 Bridge 获取当前场景和已加载对象的权威结构。

索引缓存必须记录：

- 项目 ID。
- Creator 版本。
- 扫描时间。
- 输入文件 mtime 或摘要。
- 是否来自文件扫描或 Creator 编辑器。

当 AssetDB 正在刷新、场景未保存或文件时间戳变化时，缓存必须失效。

## 输出约束

- 默认节点树深度不超过 8，节点不超过 500。
- 默认每个组件只返回白名单属性。
- 大型项目资产列表分页返回。
- 不把 `.fire`、`.prefab` 或生成缓存全文发送到模型。
