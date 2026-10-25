# Cocos Creator CLI SafeArea 验收（2.4.15）

日期：2026-10-25  
工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`  
Creator：2.4.15  
CLI：0.12.62  
扩展：0.8.111

本轮编辑和验收仅使用 Cocos CLI/MCP，没有使用电脑 UI 自动化，也没有直接修改 `.fire`。当前 Creator 实例 `ea87bcd8-5205-46f5-9339-74b2ccf07f65` 对应 Tank，活动场景 `CliAcceptanceScene` UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`。测试前场景 SHA-256 为 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` SHA-256 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。

## CLI 依赖与 Inspector 读回

目标 Canvas UUID `a4BTV8Z6tCnJw/YVbbE8Wk` 已有 `cc.Canvas` 和 `cc.Widget`。CLI 为其生成 SafeArea 添加计划 `043ece92-7f0b-4a2c-96a8-8b29fe0b1eb3`，计划哈希 `596b42a35a4478ba2828e7b65f49337b7f6f1865d6b6e82df6baf32f11ac6013`；提交后新增 `cc.SafeArea` 实例 `39KXhC/cxNW7ClzDwx1NDI`，Creator 磁盘读回确认序列化类型、实例身份及 Canvas 变换未改变。

CLI `creator.scene.ui.inspect` 对该组件返回 `enabled=true`，Inspector 类型为 Boolean、可编辑并序列化为 `_enabled`。公开声明中 `node`、`name`、`uuid`、`enabled`、`enabledInHierarchy` 共 5 项；只有 `enabled` 是可序列化的组件属性，且它是通用组件开关，不是 SafeArea 专属配置。因而 SafeArea 没有可配置的专属 Inspector 字段。

依赖负向检查在 `CliScrollViewTest`（UUID `e5208b4b-2097-4b32-a721-e5065b5617eb`，无 Widget）上规划添加 SafeArea，CLI 以 `SCENE_COMPONENT_HAS_UNAPPROVED_REQUIREMENT` 拒绝；该计划不产生写入。

## 移除与恢复

CLI 为精确 SafeArea 实例生成移除计划 `81c5a154-864e-453b-9cf4-0e5a6139ba55`，计划哈希 `06a2155ed810af43e175359f4c817d26e916516fb917be4035b84a4827f34066`。提交回执确认实例不存在，Creator 保存的 `.fire` 哈希恢复为 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` 保持 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。

Cocos CLI 关闭 PID `89149` 并确认进程退出，再从同一路径重开 Tank。新进程 PID `89800`、实例 `9d937e67-6d3b-4aa6-8c3f-aa14ceff90d1` 返回 `editorReady=true`；重开后 Creator 项目读回确认 Tank 路径、Creator 2.4.15、扩展 0.8.111 和原场景 UUID。场景快照为 23 个节点，Canvas 仅含原有 `cc.Canvas`、`cc.Widget`。两个文件哈希仍为上述基线。

本轮证明 CLI 可在满足 Widget 前置条件时添加 SafeArea、读回其 Inspector 字段，并精确移除恢复。设备安全区的实际布局效果仍待目标设备验收，不能由 Web Preview 或 Inspector 读回推断。
