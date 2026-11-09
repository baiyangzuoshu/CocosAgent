# 第 18 课：Prompt 与运行时上下文

**目标：** 观察 Prompt 段落、变量、组装事件和运行时上下文怎样变成可检查的模型消息。

## 本课问题

部署指令、插件贡献和当前工作区事实如何一起进入请求？哪些信息属于可复用的 system prompt，哪些应该作为会变化的 runtime-context 快照？

## 本课增量

本课加入一个教学版 `SystemPrompt` 注册表：按顺序组合指令段落，解析 `{{variable}}`，并允许 `system-prompt/assemble` waterfall 包装组装结果。运行时上下文由独立 provider 提供，渲染后成为带来源信息的 user-role 快照。最后将 system prompt、用户请求和 runtime context 输出为 JSON 消息。

```text
section providers ─┐
variable providers ├─ assemble(context) → system-prompt/assemble waterfall
context providers ─┘            │
                                 ├─ renderPrompt() → system message
                                 └─ renderRuntimeContext() → runtime-context user message
user input ────────────────────────────────────────────→ user message
```

示例连续组装两次请求：system 指令保持一致，工作目录和分支上下文随 assembly context 改变。组装事件 listener 在下游完成后追加一条输出约定；最终打印每条消息的 role、source 和 content。

## 源码对照

- [`packages/core/system-prompt/README.zh.md`](../../../deepseek-harness/packages/core/system-prompt/README.zh.md)：Prompt section、variable、context 的注册与组装合同。
- [`packages/core/system-prompt/src/index.ts`](../../../deepseek-harness/packages/core/system-prompt/src/index.ts)：注册表、确定性排序、`assemble()`、Waterfall 及 `renderPrompt()`。
- [`packages/core/agent-loop/src/agent.ts`](../../../deepseek-harness/packages/core/agent-loop/src/agent.ts)：每个拟议 Step 调用 `assemble()`，并在请求准入时追加 system/user 消息。
- [`packages/core/agent-loop/src/runtime-context.ts`](../../../deepseek-harness/packages/core/agent-loop/src/runtime-context.ts)：动态上下文快照及重复快照抑制。
- [`docs/architecture.md#turn-flow`](../../../deepseek-harness/docs/architecture.md#turn-flow)：Prompt、运行时上下文、Session 历史到模型请求的流程。

## 代码结构

```text
s18_prompt_runtime_context/
├── README.md
├── deno.json
└── src/
    ├── main.ts
    ├── prompt-registry.ts
    ├── render.ts
    └── types.ts
```

## 运行

在本课目录执行：

```sh
deno task check
deno task run
```

预期观察：每次组装都触发一次 `[system-prompt/assemble]`；system message 的顺序为部署 persona、response rules、事件追加的输出约定。两次请求的 system prompt 不变，但 runtime-context user message 分别包含不同工作目录和分支。用户输入仍是一条独立 user message。

## 观察结果

- `section()` 贡献系统指令；section 按 `order` 升序排列，同序按名称排序。`{{response_language}}` 和 `{{model}}` 在渲染阶段插值。
- `variable()` 在每次组装时读取事实。真实循环提供当前 provider/model，插件也可以提供自己拥有的变量；未知或无值变量会在组装前使渲染失败。
- `context()` 提供动态事实，与 system prompt section 分开排序与渲染。AgentLoop 把它们包成完整 runtime-context snapshot，并作为带 `runtime-context` 来源的 user message 写进 Session surface。
- `system-prompt/assemble` 是 waterfall。只观察的监听器要调用并等待 `next()`；监听器可以返回调整后的 sections/contexts/variables，但工具 schema 仍由 provider 所有。
- AgentLoop 在每个拟议 Step 组装一次；路由准备后会再次刷新注册的 runtime facts，再把快照纳入该次请求。相同快照不会重复追加；变化时追加新快照，并在文本中声明较新的事实覆盖旧快照，历史事件仍然保留。
- system prompt 与 runtime context 使用不同消息角色/来源：前者承载可复用指令，后者承载容易变化的工作区事实。

## 简化与边界

- 示例没有启动 Cordis 或真实 AgentLoop；`PromptRegistry` 只复刻 section、variable、context 和 waterfall 的主路径。
- 只实现按数值顺序与名称排序、简单插值及一次组装事件。没有作用域遮蔽、完整提示词段、运行时上下文抑制、工具 schema、严格插值错误分类和异步 provider 取消。
- 两次请求独立输出，未重建完整 Session surface 投影或在日志中替换旧 runtime-context 节点；真实 loop 使用 `RuntimeContextProjection` 做快照去重和替换。
- 示例里的模型消息保留 role 与 source 便于观察，不构成特定 LLM Provider 的 wire 格式。各 Provider 对 system prompt 和 request envelope 的序列化由后续课程介绍。

---

下一课：[LLM 服务与 Provider](../s19_llm_service_provider/README.md) 会展示 Fake Provider 如何接入统一模型接口。
