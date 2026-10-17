# CocosAgent Creator 2.4.15 大型工具结果归档取回实机记录

日期：2026-10-16 14:10 UTC
工程：隔离工程 `/private/tmp/CocosAgentNativeAcceptance-20261016`
模式：Creator 原生 Agent，Ask，只读任务，TypeScript Agent Core

## 验收结果

- 原始工具 `cocos_2x_skills_list` 的成功结果被本机 run 专属档案保存，原始 `callId` 为 `call_00_oPSmF78htco6mRIvKrwJ8973`，完整 payload 为 **14,517 字符**。
- 档案 envelope 读回的 `runId` 为 `461c857f-307f-4e72-931f-5e6225edfbb1`，`callId` 与工具调用一致，`toolName` 为 `cocos_2x_skills_list`，payload 长度为 14,517。文件大小 15,416 bytes、权限 `0600`；run 的 `.tool-results` 目录权限 `0700`。
- Creator 面板随后调用 `agent_tool_result_read` 四次，四次工具回执均为 `success=true, outcome=read`。面板最终报告读取区间为 `0–4000`、`4000–8000`、`8000–12000`、`12000–14517`，偏移连续，末块 `nextOffset=null`，每块返回的 call ID 均与原始 call ID 相同。
- 任务只读取技能清单，没有 Creator 内容写入。

## 本机证据定位与限制

- Agent run 记录：`~/.local/state/CocosAgent/agent-runs/2026-10-16T14-10-43-347Z-acdd6851.jsonl`。
- 归档 payload：同目录 `2026-10-16T14-10-43-347Z-acdd6851.jsonl.tool-results/64982d7d8708ae9c12e798c4ab73d17f4e56b420a3204644a4dab35923d08a5e.json`。
- 归档 envelope SHA-256：`0d852d54cac520aae401db101be38b03249bf91113456f1db699d925832c8a19`。
- run log 记录了原始调用和四次成功取回调用，但会省略工具参数及读取块正文；连续 offset、块长度和 call ID 对应关系来自该轮 Creator 面板最终报告。完整工具结果保留在本机用户状态目录，没有复制进仓库。

## 验收边界

这项实机证据只覆盖 Creator 2.4.15 隔离工程中一个大型只读工具结果的归档、精确 call ID 分块取回和完整长度对账。它不证明 Provider context overflow 的降预算压缩重试，不关闭当前摘要修复版本的 Creator/Host 重启回归，也不覆盖 LinkUpClient 的项目上下文或面板工具分发路径；这些仍待分别实测。它也不替代自动测试对跨 run 拒绝、任意路径隔离和大小限制的覆盖。
