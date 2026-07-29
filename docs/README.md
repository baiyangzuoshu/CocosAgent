# CocosAgent 设计文档

CocosAgent 是面向 Cocos Creator 2.4.15 的本地 AI 开发代理。它通过受控工具读取游戏项目、
修改脚本、理解场景与 Prefab，并借助 Creator 扩展操作编辑器、AssetDB、预览和构建流程。

## 已确定基线

- Creator：`/Applications/Cocos/Creator/2.4.15/CocosCreator.app`
- 引擎源码：`engine2.4.15/`
- 测试项目：`cocos-2.4.15-demo/`
- 品牌母版：`branding/cocos-agent-icon.png`
- 首期仅支持 Cocos Creator 2.4.15，不兼容 Creator 3.x。

## 文档索引

1. [产品定义与范围](PRODUCT.md)
2. [总体架构](ARCHITECTURE.md)
3. [Cocos 项目模型](COCOS_PROJECT_MODEL.md)
4. [Creator 编辑器桥](EDITOR_BRIDGE.md)
5. [Agent 工具设计](TOOL_DESIGN.md)
6. [Scene 与 Prefab 安全策略](SCENE_PREFAB_SAFETY.md)
7. [权限模型](PERMISSIONS.md)
8. [MVP 路线图](MVP_ROADMAP.md)
9. [测试策略](TEST_STRATEGY.md)

## 核心原则

- `engine2.4.15/` 是只读知识源，不是默认编辑目标。
- `library/`、`temp/`、`local/` 和 `build/` 是生成目录，不作为事实来源。
- Scene、Prefab、Meta 和 UUID 修改优先通过 Creator Editor API 完成。
- 所有修改均受权限系统约束，并在修改前后生成可审计事件。
- Agent 只能连接本机回环地址上的 Creator Bridge。
- 首期优先保证可验证和可回滚，再扩大自动化范围。
