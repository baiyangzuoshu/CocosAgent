# CocosAgent Creator 2.4.15 长会话摘要实机验收

日期：2026-10-16
工程：隔离工程 `CocosAgentNativeAcceptance-20261016`
扩展：CocosAgent v0.3.16；Creator：2.4.15

## 验收过程与结果

- 复现修复前的问题：旧摘要丢失精确约束，模型把早期标记 `KEEP-731` 错答为 `MINT-4827`。该失败仅作回归背景；修复后的正式断言使用全新标记。
- 在原面板会话写入用户约束标记 `FERN-9901`，随后通过多个 Ask 回合将该消息推出最近 24 条消息窗口。每回合要求只回复当回合随机序号，无 Creator 工程写入或记忆操作。
- 从 Host state store 只读核对：消息数为 24，摘要 revision 为 31、覆盖 62 条历史消息，`preservedUserMessages` 含 9 条用户原文摘录，其中包含 `FERN-9901`；该标记已不在最近消息中。
- 完整退出并重新启动 `/Applications/Cocos/Creator/2.4.15/CocosCreator.app`，工程与 Assistant 面板恢复原会话。切换回原使用的 DeepSeek Flash 后询问保存的精确标记，Creator 面板回答 `FERN-9901`。Creator v0.3.16 与工程路径 `/private/tmp/CocosAgentNativeAcceptance-20261016` 均在面板确认。
- 完成后 Provider 设置恢复为 DeepSeek Flash，连接状态正常。没有进行 Creator 内容写入；测试对话仅在隔离验收工程的本机状态中。

## 证据与边界

精确标记恢复回合运行记录：`~/.local/state/CocosAgent/agent-runs/2026-10-16T00-22-30-354Z-3526b083.jsonl`。完整消息与摘要记录保存在该机对应工程哈希的 Assistant state store，未将用户目录状态文件复制进仓库。

这项实机验收只覆盖长会话裁剪、摘要中独立保存用户原文摘录，以及完整 Creator/Host 重启后的精确回忆。它不证明摘要可作为授权、写入回执或 Creator 状态证据。Provider 上下文超限降预算重试、超预算触发与大型工具结果按精确 call ID 分块取回仍待 Creator 面板实机验收；实机范围为隔离工程，不是实际游戏工程。
