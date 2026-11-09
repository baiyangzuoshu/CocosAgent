# 第 13 课：Claude 当前有哪些产品形态和适用场景？

**目标：** 能从任务类型选择适合的 Claude 产品入口，并核对该入口的设备、计划、地区与发布状态，不把某一时点的产品菜单当作永久清单。

## 本课问题

Claude 既能通过聊天界面使用，也能参与多步骤工作、软件开发、科学分析或团队协作。怎样按“要完成什么工作”选入口，又怎样确认这个功能目前是否对自己的账户开放？

## 官方资料

- [Claude 产品总览](https://claude.com/product/overview)：面向用户的产品入口与场景介绍。
- [下载 Claude](https://claude.com/download)：当前桌面、移动和相关产品入口；页面把 Products、Capabilities、Extensions 与 Platform 分开展示。
- [产品场景矩阵](https://claude.com/resources/guides/claude-cowork-product-guide/product-overview)：比较 Chat、Claude Code 和 Claude Cowork 的主要任务类型。
- [Claude Cowork 与 Chat 合并说明](https://support.claude.com/en/articles/16761823-claude-cowork-and-chat-are-one-claude)：说明统一界面的分批推出情况。
- [Claude Code](https://claude.com/product/claude-code)、[Claude Duet](https://support.claude.com/en/articles/17631495-get-started-with-claude-duet)、[Claude Tag](https://support.claude.com/en/articles/15594475-what-is-claude-tag)、[Claude Science](https://support.claude.com/en/articles/16563838-get-started-with-claude-science)、[Claude Security](https://support.claude.com/en/articles/14661296-use-claude-security)：了解面向开发、知识工作、Slack 协作、科学研究与代码安全的具体产品和状态。
- [Claude in Chrome](https://claude.com/claude-in-chrome) 与 [Claude for Microsoft 365](https://claude.com/claude-for-microsoft-365)：了解浏览器和 Office 场景的扩展入口。

核对日期：2026-11-09。这里记录的是当天官方页面的产品与状态快照，不承诺地区、账户或后续版本都具有相同入口。

## 1. 先按工作类型分类

Anthropic 当前产品页面把 Claude、Claude Code、Claude Cowork、Claude Duet、Claude Tag、Claude Science、Claude Security 等列为产品入口，并把 Claude in Chrome、Microsoft 365 等放在扩展或集成入口。产品页面也将 Artifacts、Connectors、Plugins 和 Skills 作为跨产品能力单独列出。这个页面结构有助于导航，但不是一套永远固定的技术分类。[下载 Claude](https://claude.com/download)

| 任务模式或入口 | 适合的工作 | 当前状态或边界（2026-11-09） |
| --- | --- | --- |
| **Chat / Claude 应用** | 问答、写作、研究和分析；适合逐轮交流、补充上下文和检查草稿。 | 可从网页、桌面和移动入口开始；具体功能随账户计划和使用界面而变。 |
| **Cowork / 统一 Claude 体验** | 把目标交给 Claude，跨文件、连接器和浏览器执行多步骤知识工作，再检查生成的文件或结果。 | Chat 与 Cowork 的统一界面正在分批推出；有些账户仍显示独立模式。访问本机文件时可能要求桌面应用保持打开。 |
| **Claude Code** | 理解代码库、设计改动、修复缺陷、编辑代码和运行测试。 | 可在终端、IDE、桌面、网页等开发入口使用；具体平台和账户方式查看官方文档。 |
| **Claude Duet** | 主动整理需要关注的事项，跨已连接应用继续做后台任务，并在需要决定时回来询问。 | 研究预览；当前通过美国 Pro、Max、Ultra 用户的候补名单提供，且可能误判优先级或遗漏新信息。 |
| **Claude Tag** | 在 Slack 频道或对话里基于团队上下文协作、汇总和跟进任务。 | 当前为 Team 和 Enterprise 计划的 beta；频道使用的身份、工具和访问范围由组织配置。 |
| **Claude Science** | 在桌面研究环境中分析科研数据、运行代码、使用科学数据库或连接自己的计算集群。 | 当前为 beta；运行平台、组织开关和可用能力以帮助中心为准。 |
| **Claude Security** | 扫描组织代码库、跟踪漏洞发现并生成供人工检查的补丁建议。 | 当前对 Enterprise 用户提供 public beta；扫描结果和修复建议仍需安全团队复核。 |

产品名单和上表中的适用状态会变化；要找某个产品的当前入口，先看 [Claude 官方产品页](https://claude.com/download)，再打开对应产品和帮助中心页面。

## 2. 产品名、运行界面和附加能力不是一回事

同一个工作方式可能从多个地方启动；同一个桌面或网页应用也可能包含不止一种工作模式。可以按三层来读：

| 层次 | 例子 | 阅读时要问 |
| --- | --- | --- |
| **工作方式** | Chat、Cowork、Code | Claude 是逐条回答、代办多步骤任务，还是在代码库中协作？ |
| **运行界面** | 网页、桌面、移动应用、终端、IDE、Slack | 任务在哪个应用里发起，结果在哪查看？本地文件或工具是否可用？ |
| **附加能力** | Connectors、Skills、Plugins、Artifacts、Claude in Chrome、Microsoft 365 | Claude 能访问哪些资料或执行哪些操作？这些功能由谁开启、授权和管理？ |

Claude 的新体验正把 Chat 和 Cowork 合并为同一对话入口，并分批开放；因此，学习时应先判断任务类型，再核对自己账户当前看到的界面，不要因为某篇文章还写有“切换到 Cowork”就认定所有账户都有相同按钮。[统一体验说明](https://support.claude.com/en/articles/16761823-claude-cowork-and-chat-are-one-claude)

## 3. 按任务路由

```text
问答、草拟或分析一个问题
  → Claude Chat

跨文件、应用或浏览器完成多步骤交付
  → Cowork / 已推出统一体验的 Claude

修改或验证代码库
  → Claude Code

科学数据分析
  → Claude Science（当前 beta）

团队在 Slack 频道协作和跟进
  → Claude Tag（当前 beta）

持续跟踪代码漏洞和修复
  → Claude Security（当前 Enterprise public beta）

需要浏览网页或操作 Office 文档
  → 查看 Claude in Chrome 或 Microsoft 365 等集成能力
```

如果目标是把模型嵌进自己开发的产品，应回到第12课的 Claude Platform；如果要选直接 API 或云平台渠道，后续第14课再比较具体的认证、功能和责任边界。

## 4. 用集成时核对权限和状态

扩展或连接器能把 Claude 放进熟悉的工作工具，但“能读取信息”与“能代表用户操作”是不同权限。使用浏览器控制、邮箱、团队频道、代码库或本机文件前，确认连接范围、可执行操作、批准步骤和审核入口。

- Claude in Chrome 可读取并操作当前网页。官方说明浏览器内容可能包含提示注入，且 Claude 也可能误解页面；确认操作范围，并检查有影响的操作。[安全说明](https://claude.com/claude-in-chrome)
- Claude for Microsoft 365 把 Claude 放进 Word、Excel、PowerPoint 和 Outlook 等工作流。核对具体应用的当前状态；官方页面当时标记 Outlook 为 beta，而其他 Office 插件可用状态不同。[Microsoft 365 产品页](https://claude.com/claude-for-microsoft-365)
- Cowork 的多步骤任务会消耗更多使用量，并可能在本机桌面文件、云端会话或已连接工具之间运行；开始任务前确认文件位置和连接器权限。[Cowork 帮助中心](https://support.claude.com/en/articles/13345190-get-started-with-claude-cowork)

这些产品功能不会让模型自动拥有所有设备或账户权限；实际可访问范围由账户计划、用户授权、组织管理员和具体客户端配置决定。

## 5. 练习：为工作选入口

1. “我想讨论一份报告的结论，先一起起草，再逐段修改。”
2. “请整理我选定的几份本地资料，比较方案并交付一份表格。”
3. “在一个陌生仓库里定位 bug、改代码并运行相关测试。”
4. “让 Claude 在 Slack 工程频道总结决策，并按组织设置跟进任务。”
5. “分析实验数据，并将可复现的代码和结果保存下来。”
6. “扫描公司仓库中的漏洞并建议修补方式。”

**参考答案：** 1 Chat；2 Cowork 或已推出统一体验的 Claude；3 Claude Code；4 Claude Tag（当前为 beta，并由组织控制权限）；5 Claude Science（当前为 beta）；6 Claude Security（当前为 Enterprise public beta）。每项还应检查设备、计划、地区、账户 rollout、连接器和数据访问权限。

## 本课结论

先按工作模式选择入口：对话、跨应用代办、代码开发、科学分析、Slack 协作或代码安全，再核对具体客户端、计划、地区与发布状态。用浏览器、文件、代码库或企业工具时，还要确认权限边界和人工复核方式。产品名称和界面会更新，课程中的日期快照只能帮助定位，不能替代当前官方帮助中心。

## 范围与时效

- 官方产品与帮助页面核对日期为 2026-11-09。
- Cowork/Chat 正在统一体验分批推出；Duet、Tag、Science、Security 等有预览或 beta 状态。具体访问资格可能因账户、地区和组织设置不同。
- 本课只做任务类型和入口选择，不记录价格，也不展开 Claude Platform API 与云平台渠道。
