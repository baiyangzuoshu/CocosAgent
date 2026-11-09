# DeepSeek Harness 逐课复刻

逐课建立一个简化、可运行的 DeepSeek Harness。学习代码按 TypeScript + Deno 组织；目标实现对照工作区中的 [`deepseek-harness`](../../deepseek-harness/README.md) 源码。课程不导入 Harness 包，也不要求真实模型凭据。

## 学习方式

1. 每课先说明问题、源码入口和本课增量。
2. 每课目录包含完整、独立可运行的代码快照；后一课增加一个机制，不依赖前一课的运行状态。
3. 运行最小示例，观察结果，再对照 Harness 源码解释调用关系。
4. 每课写明简化点；示例帮助理解架构，不追求替代完整 Harness。

课程按当前工作区中的 Harness 实现编写。项目处于 developer preview，开始每课时核对源码和文档是否仍对应。源码链接假定 `Cocos_Engine` 与 `deepseek-harness` 位于同一 `WORK` 目录下。

## 课程

- [课程总纲](课程大纲.md)
- [第 0 课：最小插件启动器](s00_minimal_plugin/README.md)
- [第 1 课：Context 与 Service](s01_context_service/README.md)
- [第 2 课：依赖注入](s02_injection/README.md)
- [第 3 课：生命周期与 effect](s03_lifecycle_effects/README.md)
- [第 4 课：事件分发](s04_event_dispatch/README.md)
- [第 5 课：Waterfall](s05_waterfall/README.md)
- [第 6 课：配置与校验](s06_config_validation/README.md)
- [第 7 课：Loader 组合](s07_loader_composition/README.md)
- [第 8 课：Profile、Bundle 与 patch](s08_profile_bundle_patch/README.md)
- [第 9 课：CLI 与 Headless 启动](s09_cli_headless_boot/README.md)
- [第 10 课：Session 事件日志](s10_session_event_log/README.md)

各课使用 Deno 独立运行 TypeScript 示例。课程代码不依赖目标仓库的构建产物、不修改其文件；核心 Agent 示例使用模拟模型。
