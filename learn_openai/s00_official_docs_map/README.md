# 第 0 课：OpenAI 官网与文档地图

**目标：** 知道 OpenAI 官方学习入口、开发者文档和 API Reference 分别解决什么问题，并能把问题路由到下一份资料。

## 本课问题

遇到一个 OpenAI 开发问题时，应该先看学习路径、概念指南、实现指南，还是 API Reference？

## 官方资料

- [OpenAI Learn](https://developers.openai.com/learn)：学习轨道、示例应用和视频。当前开发者学习轨道包括 Building agents、AI app development 和 Model optimization。
- [OpenAI API Platform 文档](https://developers.openai.com/api/docs)：Quickstart、关键概念、Responses API、模型、工具、Agents、生产实践等。
- [API Reference 总览](https://developers.openai.com/api/reference/overview)：端点、请求与响应 Schema、流式事件、客户端库方法、认证、错误和速率限制。
- [Key concepts](https://developers.openai.com/api/docs/concepts)：模型、Prompt、Token、上下文和 Embedding 等基础术语。
- [Agents 文档入口](https://developers.openai.com/api/docs/guides/agents)：选择运行方式，了解 Responses API、Agents SDK、Agents API 和 ChatKit 的区别。

## 文档导航

| 我的问题 | 优先入口 | 用途 |
| --- | --- | --- |
| 我应该按什么顺序学？ | OpenAI Learn | 选学习轨道和示例 |
| 这个概念是什么意思？ | API 文档中的 Key concepts 或对应指南 | 理解概念与推荐用法 |
| 我要怎样实现某个能力？ | 对应功能指南，如 Prompting、Tools、Agents | 看工作流程和示例 |
| 这个 API 字段是什么类型？ | API Reference | 查精确 Schema、参数、事件与错误 |
| 这个模型现在支持什么？ | Models 页面和对应能力指南 | 核对当前能力、限制与可用性 |
| 某功能是否更新、弃用或迁移？ | Changelog、Deprecations 和对应指南 | 核对产品生命周期与迁移方式 |

## 核心地图

```text
OpenAI Learn（学习路线）
        ↓
API 文档（概念与实现指南）
        ↓
API Reference（字段、Schema、事件和错误细节）
```

举例：如果要让游戏中的 NPC 根据玩家背包生成建议，可以按这个顺序定位：

1. 从 API Quickstart 和 Responses API 指南了解应用如何提交请求。
2. 从 Function Calling 指南了解如何让模型请求应用查询玩家背包。
3. 需要精确确认 `tools`、参数 Schema 或返回结构时，再查 API Reference。
4. 若 NPC 需要多步规划、工具路由、审批或跨轮状态，再进入 Agents 课程。

这条路径是导航示例，不代表 NPC 一定需要 Agent。先明确任务，再选最小合适的能力。

## 本课观察结果

看到一个问题时，能快速判断它属于哪一类：

- 学习顺序：Learn。
- 概念说明：Key concepts 或对应专题指南。
- 怎么实现：功能指南和 Quickstart。
- 字段与精确行为：API Reference。
- 是否仍然有效：Changelog、Deprecations 和当前指南。

本课不调用 API，也不需要 API Key。可观察结果是能为一个实际任务列出资料阅读顺序。

## 练习

假设你要让游戏 NPC 查询玩家背包，并根据装备生成建议：你会先看哪两个官方资料入口？分别要从中确认什么？

## 简化与边界

- 这张地图聚焦 OpenAI 开发者知识。ChatGPT 和 Codex 的终端用户功能另有产品文档，本课不把它们与 API 混成一套概念。
- 官方导航和产品状态会变化。涉及模型名称、价格、权限、可用性和弃用时间时，按学习当日的官方页面重新核对。
- 本课程说明会帮助定位官方资料；若官方页面没有明确写出某项行为，会标注为推断或待确认，不把推断说成官方保证。
