# Anthropic 官方资料学习

以 Anthropic 官方网站和 Claude Platform 文档为资料入口，逐课认识 Anthropic 的公司使命、研究与安全治理，以及 Claude 产品和开发者平台。课程解释官方页面、术语和资料之间的关系；不把公司的目标陈述当作独立验证结论，也不把某一时点的模型与产品清单写成长期事实。

课程暂定 **37 课**，编号 `s00`–`s36`。目前已完成第 00–36 课。

## 学习方式

每课围绕一个问题，按以下顺序阅读和观察：

1. 先说明本课问题和预期结果。
2. 从 Anthropic 官方页面找到一手资料。
3. 记录官方陈述、事实描述和自己的推断分别是什么。
4. 用一张关系图、资料对照表或最小请求说明理解结果。
5. 标出页面日期、版本、适用平台和仍需核对的内容。

概念课不需要账户或 API Key。开发者课程会优先用不含真实密钥的示例；实际接入时再按官方 Quickstart 配置环境。

## 课程入口

- [课程总纲](课程大纲.md)
- [第 00 课：Anthropic 官网与官方资料地图](s00_official_site_map/README.md)
- [第 01 课：Anthropic 如何描述自己的使命](s01_company_mission/README.md)
- [第 02 课：PBC 身份与长期利益信托](s02_pbc_governance/README.md)
- [第 03 课：公共利益工作与受益领域](s03_public_benefit_areas/README.md)
- [第 04 课：Anthropic 的研究主题地图](s04_research_map/README.md)
- [第 05 课：可解释性研究主要试图回答什么问题？](s05_interpretability_questions/README.md)
- [第 06 课：对齐研究和行为评估如何关联？](s06_alignment_behavior_evaluations/README.md)
- [第 07 课：Frontier Red Team、经济与社会影响研究](s07_research_domains/README.md)
- [第 08 课：Claude’s Constitution 是什么类型的文件？](s08_claude_constitution/README.md)
- [第 09 课：Responsible Scaling Policy 试图处理什么问题？](s09_responsible_scaling_policy/README.md)
- [第 10 课：如何阅读 Claude 的 System Card 和 Model Report？](s10_system_cards_model_reports/README.md)
- [第 11 课：Transparency Hub 如何汇总模型信息和公开承诺？](s11_transparency_hub/README.md)
- [第 12 课：面向用户的 Claude 产品与 Claude Platform 有什么区别？](s12_claude_vs_platform/README.md)
- [第 13 课：Claude 当前有哪些产品形态和适用场景？](s13_claude_products_use_cases/README.md)
- [第 14 课：Claude API 与云平台渠道的文档和责任边界是什么？](s14_api_cloud_channels/README.md)
- [第 15 课：API Key、工作区和认证如何配合？](s15_api_keys_workspaces_auth/README.md)
- [第 16 课：如何发出第一个 Messages API 请求？](s16_first_messages_request/README.md)
- [第 17 课：Messages 请求与响应由哪些部分组成？](s17_messages_request_response/README.md)
- [第 18 课：system 指令、消息角色与上下文如何组织？](s18_system_roles_context/README.md)
- [第 19 课：多轮对话如何保留或延续状态？](s19_conversation_state/README.md)
- [第 20 课：工具调用如何形成完整闭环？](s20_tool_use_loop/README.md)
- [第 21 课：结构化输出如何帮助应用读取结果？](s21_structured_outputs/README.md)
- [第 22 课：图片、文件和其他输入能力如何进入请求？](s22_multimodal_inputs/README.md)
- [第 23 课：Streaming、批处理和 Token 计数分别解决什么问题？](s23_streaming_batches_tokens/README.md)
- [第 24 课：API 错误、重试和速率限制怎样处理？](s24_api_errors_rate_limits/README.md)
- [第 25 课：如何选择模型和部署平台？](s25_model_and_platform_selection/README.md)
- [第 26 课：如何建立 Claude 应用的质量评估？](s26_claude_app_evaluation/README.md)
- [第 27 课：工具权限、提示注入和副作用如何纳入安全设计？](s27_tool_security_prompt_injection/README.md)
- [第 28 课：生产应用如何管理密钥、数据、成本与可观测性？](s28_production_operations/README.md)
- [第 29 课：如何跟踪 API 版本、模型更新和弃用？](s29_versioning_migrations/README.md)
- [第 30 课：如何把 Anthropic 官方资料整理成可复查的结论？](s30_official_source_verification/README.md)
- [第 31 课：MCP Connector 如何把远程工具接入 Messages API？](s31_mcp_connector/README.md)
- [第 32 课：Claude Managed Agents 如何组织配置、运行环境和会话？](s32_managed_agents_lifecycle/README.md)
- [第 33 课：Claude Managed Agents Workflow Runs 如何并行编排复杂任务？](s33_managed_agents_workflows/README.md)
- [第 34 课：Claude Managed Agents Scheduled Deployments 如何运行周期任务？](s34_scheduled_deployments/README.md)
- [第 35 课：Claude Managed Agents Memory Stores 如何让 Agent 跨 Session 记住信息？](s35_agent_memory_stores/README.md)
- [第 36 课：Claude Managed Agents Skills 如何复用领域工作流？](s36_managed_agent_skills/README.md)

## 资料范围

- [Anthropic 官网](https://www.anthropic.com/)：公司、研究、政策、承诺、产品和新闻的公开入口。
- [Claude Platform 文档](https://platform.claude.com/docs)：Claude API、开发者功能、SDK 和 API Reference。
- Claude.ai 等面向用户的产品页面单独学习，不与 Claude API 的开发者概念混用。

## 易变内容

模型名称、产品入口、API 功能、政策版本和发布时间会变化。课程给出官方查证路径；涉及当前状态时，以学习当天的页面和版本为准。首轮页面核对日期：2026-11-09。
