<div align="center">
  <img src="branding/cocos-agent-icon.png" width="180" alt="CocosAgent icon">

# CocosAgent

面向 Cocos Creator 2.4.15 的本地、权限受控 AI 游戏开发 Agent。

**理解项目 · 操作编辑器 · 修改脚本与场景 · 运行预览与构建**

</div>

## 项目简介

CocosAgent 旨在让 AI 不仅能够编写 Cocos 脚本，还能理解游戏项目结构，并通过受控的 Creator
编辑器桥执行节点、组件、资源、预览和构建操作。

```text
CocosAgent
= 模型推理
+ Cocos 项目上下文
+ Creator 编辑器与构建工具
+ 开发者协作界面
```

项目采用本地优先架构：游戏工程保留在开发者电脑上，所有修改经过权限判断，Scene、Prefab、
Meta 和 UUID 等高风险数据受到专门保护。

> 当前状态：设计与开发基线阶段。首个版本仅面向 Cocos Creator 2.4.15，核心功能正在按
> [MVP 路线图](docs/MVP_ROADMAP.md)实施。

## 目标能力

- 识别 Cocos Creator 项目、版本、资源和脚本结构。
- 索引 Scene、Prefab、Component、Texture、Audio 和 Animation。
- 创建及修改 TypeScript/JavaScript 组件，并读取 Creator 编译日志。
- 读取当前场景节点树，创建节点、挂载组件和设置安全属性。
- 通过 AssetDB 导入、查询和刷新资源，不手工生成 UUID。
- 启动 Web Preview，采集有界日志并执行 Web 构建。
- 为每次变更提供审批、审计、恢复点和修改后验证。
- 在未来支持 Prefab 工作流、视觉验证和资源依赖分析。

## 为什么需要 Creator Bridge

`.fire`、`.prefab` 和 `.meta` 并不是适合任意文本编辑的普通 JSON。直接修改可能破坏对象索引、
UUID 引用、组件关系和 Prefab 同步状态。

CocosAgent 通过项目内的 Creator Extension 与编辑器通信：

```text
CocosAgent Desktop
        ↓ HTTP / NDJSON
Agent Runtime
        ↓ 结构化工具
Cocos Services
        ↓ 127.0.0.1 + 临时会话
Creator Bridge Extension
        ↓ Editor.Ipc / Scene Script / AssetDB
Cocos Creator 2.4.15
```

Bridge 只监听本机回环地址，只接受固定命令和经过校验的参数，不执行模型生成的任意 JavaScript
或 Shell 命令。

## 安全原则

- `engine2.4.15/` 只作为引擎知识源，默认禁止修改。
- `library/`、`temp/`、`local/` 和 `build/` 是生成目录，不作为项目事实来源。
- Scene 和 Prefab 优先通过 Creator Editor API 修改。
- `.fire`、`.prefab` 和 `.meta` 默认禁止通用文件工具直接写入。
- UUID 由 Creator AssetDB 管理，Agent 不自行生成、替换或复用。
- Bridge 仅绑定 `127.0.0.1`，不开放到局域网或互联网。
- 写操作必须经过预览、审批、恢复点、保存、重读和验证。
- 删除、引擎修改和未解析的递归操作始终需要强确认。

完整规则见：

- [Scene 与 Prefab 安全策略](docs/SCENE_PREFAB_SAFETY.md)
- [权限模型](docs/PERMISSIONS.md)
- [AI 开发约束](AGENTS.md)

## 计划架构

```text
CocosAgent/
├── src/
│   ├── mod.ts
│   ├── runtime.ts
│   ├── registry.ts
│   ├── permissions.ts
│   ├── features/
│   │   └── cocos.ts
│   └── cocos/
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
├── cocos-2.4.15-demo/
├── engine2.4.15/
├── branding/
└── docs/
```

## 开发基线

当前设计与验证环境：

| 项目 | 基线 |
|---|---|
| Cocos Creator | 2.4.15 |
| 编辑器 | macOS Creator 2.4.15 |
| 引擎参考 | `engine2.4.15/` |
| 集成 Fixture | `cocos-2.4.15-demo/` |
| Bridge | Creator 2.4.x Package + Editor IPC |
| 首期构建目标 | Web Desktop、Web Mobile |

生产代码不能硬编码本机 Creator 安装路径。编辑器路径必须通过配置或用户选择获得。

## Fixture 项目

`cocos-2.4.15-demo/` 用于集成和破坏性测试，而不是生产项目。Fixture 将覆盖：

- 保存后的 Scene。
- Prefab 及其实例。
- 带序列化属性的自定义组件。
- Label、Sprite、Button、Layout 和 Widget。
- `assets/textures/cocos-agent-icon.png` 品牌纹理。

以下目录由 Creator 生成，不应提交：

```text
cocos-2.4.15-demo/library/
cocos-2.4.15-demo/temp/
cocos-2.4.15-demo/local/
cocos-2.4.15-demo/build/
```

## 实施路线

1. 建立仓库、Fixture、检查任务和只读保护。
2. 实现项目识别、资源索引和只读工具。
3. 建立 Creator Bridge 和只读场景连接。
4. 实现脚本创建、编辑与编译日志。
5. 实现场景节点和组件的安全写事务。
6. 实现资源导入、Web Preview 和 Web Build。
7. 增加 Prefab 工作流、视觉验证和依赖分析。

详细验收标准见 [MVP 路线图](docs/MVP_ROADMAP.md)。

## 设计文档

| 文档 | 内容 |
|---|---|
| [产品定义](docs/PRODUCT.md) | 用户、核心场景、MVP 和非目标 |
| [总体架构](docs/ARCHITECTURE.md) | 进程、模块、数据流和状态边界 |
| [项目模型](docs/COCOS_PROJECT_MODEL.md) | Project、Asset、Scene、Node、Component |
| [Creator Bridge](docs/EDITOR_BRIDGE.md) | 协议、安全、命令和能力协商 |
| [工具设计](docs/TOOL_DESIGN.md) | Cocos 工具输入、输出和权限分类 |
| [序列化安全](docs/SCENE_PREFAB_SAFETY.md) | Scene、Prefab、Meta 和 UUID 规则 |
| [权限模型](docs/PERMISSIONS.md) | ask、auto、full 与硬拒绝 |
| [MVP 路线图](docs/MVP_ROADMAP.md) | 分阶段实现及验收条件 |
| [测试策略](docs/TEST_STRATEGY.md) | 单元、Bridge、Creator 和端到端测试 |

## 当前仓库状态

当前仓库已经具备：

- 完整产品与技术设计文档。
- Creator 2.4.15 引擎源码参考。
- Creator 2.4.15 测试项目。
- CocosAgent 品牌图标。
- 面向 AI 开发者的 `AGENTS.md` 安全和架构约束。

Agent Runtime、桌面客户端和 Creator Bridge 尚在实施阶段。README 会随每个可运行里程碑更新，
避免把规划中的能力描述为已经完成。

## 参与开发

开始修改前请先阅读：

1. [AGENTS.md](AGENTS.md)
2. [设计文档索引](docs/README.md)
3. 与任务相关的协议、安全或测试文档

贡献必须遵守以下基本要求：

- 不直接修改 Cocos 序列化内部字段。
- 不弱化权限或路径边界来通过测试。
- 新工具必须有输入校验、权限分类、取消行为和有界输出。
- Creator 集成修改必须在 Creator 2.4.15 中进行原生验证。
- 产品、协议或安全边界变化必须同步更新设计文档。

## License

项目许可证尚未确定。公开使用或贡献代码前，需要补充根目录 `LICENSE`，并分别遵守 Cocos
Creator、引擎源码及第三方依赖各自的许可证。
