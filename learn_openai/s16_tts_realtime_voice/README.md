# 第 16 课：文字转语音、流式音频与实时语音对话

**目标：** 能区分单次文字转语音、边生成边播放的音频流，以及持续收发语音的会话；了解 Realtime API、GPT-Live 与分阶段语音管线各自适合什么情况。

## 本课问题

把一段文字读出来，和让用户通过语音持续跟助手交谈，为什么不是同一种 API 调用？

## 前置知识

- [第 10 课](../s10_conversation_state/README.md)：多轮对话和会话状态。
- [第 11 课](../s11_streaming_background/README.md)：流式输出与后台任务。
- [第 15 课](../s15_audio_transcription_understanding/README.md)：音频输入、文件转写与音频理解。

## 官方资料

- [Text to speech](https://developers.openai.com/api/docs/guides/text-to-speech)：查看 Speech API 的文字、声音、语气指令、音频格式和流式播放。
- [Voice agents](https://developers.openai.com/api/docs/guides/voice-agents)：比较 GPT-Live、Realtime API 和分阶段语音管线。
- [Getting started with the Realtime API](https://developers.openai.com/api/docs/guides/realtime)：查看 Realtime 会话、Agents SDK、连接方式和工具。
- [Realtime conversations](https://developers.openai.com/api/docs/guides/realtime-conversations)：了解语音轮次、VAD、对话状态和打断行为。
- [Getting started with GPT-Live](https://developers.openai.com/api/docs/guides/live)：查看全双工语音交互与委派给后端的工作方式。

## 1. 单次文字转语音：文字进去，音频出来

文字转语音（TTS）是一个有边界的生成任务：应用提供文字、模型和声音，Speech API 返回音频。应用可以播放或保存这个音频；这次请求本身不会打开麦克风、检测用户说完没有，也不会替应用维护一段语音对话。

下面示例展示 Speech API 的基本输入输出结构。它使用官方现有集成指南中的 `gpt-4o-mini-tts`，适合阅读已有代码和理解接口形状：

```ts
import { writeFile } from "node:fs/promises";
import OpenAI from "openai";

const client = new OpenAI();

const speech = await client.audio.speech.create({
  model: "gpt-4o-mini-tts",
  voice: "coral",
  input: "欢迎回来。我们继续上一节的内容。",
  instructions: "用清楚、自然、友好的语气朗读。",
});

await writeFile("./speech.mp3", Buffer.from(await speech.arrayBuffer()));
```

接口的关键字段是 `model`、`input` 和 `voice`。`instructions` 可描述语气、语速或情绪；没有设置输出格式时，Speech API 默认返回 MP3。若将生成的声音播放给用户，需明确告知用户这是 AI 生成的语音。[Text to speech](https://developers.openai.com/api/docs/guides/text-to-speech)

**模型状态要特别留意：** 截至 2026-11-10，官方将 `tts-1`、`tts-1-hd` 和 `gpt-4o-mini-tts` 标为已弃用，并计划于 2027-01-06 关闭。官方迁移方向是通过 Realtime API 使用 `gpt-realtime-2.1-mini`；这是不同的 API 工作流，不能只把上面代码里的模型名替换掉就当作完成迁移。[弃用公告](https://developers.openai.com/api/docs/deprecations)

## 2. 音频流式输出：更早开始播放，但仍是单向生成

Speech API 支持分块传输音频。应用可以在整段语音完全生成前就开始播放，减少用户等待完整文件的时间。流式解决的是**音频结果何时能开始消费**，输入依旧是已经给定的文字。

因此：

- `文字 → Speech API → 一段 MP3/WAV`：单次生成。
- `文字 → Speech API 流式响应 → 逐块播放`：同一单向生成任务，音频更早开始到达。
- `麦克风音频 ⇄ 持续语音会话`：双向实时交互，需由实时会话工作流处理。

不要把“HTTP 响应分块到达”理解成“实时语音对话”。TTS 流不会自行监听用户、判断说话轮次、取消助手当前发言或把多轮上下文串起来。[Text to speech：Streaming realtime audio](https://developers.openai.com/api/docs/guides/text-to-speech)

## 3. 实时语音会话：持续收发、理解轮次并保持对话

Realtime API 面向语音到语音的会话。会话可以直接接收用户音频、维护对话状态、输出语音，并在支持的配置中调用工具。VAD（语音活动检测）可判断用户何时开始或停止说话；打断时，会话能处理尚未播放的助手语音，避免后续对话把未听到的内容误当成已听到。

官方 Agents SDK 的浏览器起步结构如下。`OPENAI_REALTIME_EPHEMERAL_KEY` 应由应用服务器为客户端创建并提供临时凭证；不要把长期 API Key 放进浏览器：

```ts
import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime";

const ephemeralKey = process.env.OPENAI_REALTIME_EPHEMERAL_KEY;
if (!ephemeralKey) {
  throw new Error("需要由服务器提供 Realtime 临时凭证。");
}

const agent = new RealtimeAgent({
  name: "语音助手",
  instructions: "用简洁、自然的中文回答用户。",
});

const session = new RealtimeSession(agent, {
  model: "gpt-realtime-2.1",
});

await session.connect({ apiKey: ephemeralKey });
```

浏览器通常通过 WebRTC 连接实时会话；服务端音频流可以使用 WebSocket。建立连接、会话配置、音频轮次和权限由实时工作流共同管理，不等于在一次普通 TTS 请求上加一个 `stream: true`。[Getting started with the Realtime API](https://developers.openai.com/api/docs/guides/realtime)

## 4. 三种语音 Agent 架构

如果应用要让用户用语音完成任务，官方把常见架构分为三类：

| 架构 | 适合的需求 | 关键特点 |
| --- | --- | --- |
| Realtime API | 希望一个会话模型直接听、理解、调用工具并用语音回答 | 语音、推理和工具处于同一个实时会话；适合低延迟、自然轮次和打断 |
| GPT-Live | 希望语音界面持续对话，同时保留独立的后端 Agent 或业务工作流 | 语音交互由 GPT-Live 处理，推理与工具可委派到已有后端；后端工作时用户仍可继续说话 |
| 分阶段语音管线 | 需要检查或变换每个中间结果 | 应用串起语音转文字、文本 Agent、文字转语音，可在阶段之间加审核、策略或改写 |

选型核心是：谁管理语音轮次，推理和工具运行在哪里，以及应用是否需要看到并检查中间文字。GPT-Live 与 Realtime API 都支持自然语音交互，但前者侧重把工作委派给独立后端，后者把语音、推理与工具放进同一会话模型。[Voice agents](https://developers.openai.com/api/docs/guides/voice-agents)、[Getting started with GPT-Live](https://developers.openai.com/api/docs/guides/live)

## 5. 如何选工作流

| 应用需求 | 优先考虑 | 为什么 |
| --- | --- | --- |
| 把公告、文章或固定提示语生成一个音频文件 | TTS | 输入文字与最终音频文件是一对一的有界任务 |
| 只想在完整朗读结束前就开始播放音频 | TTS 流式响应 | 仍是单向合成，只改变音频传输与播放时机 |
| 用户边说边听，可能随时插话，助手也要使用工具 | Realtime API | 会话管理音频轮次、低延迟响应和打断 |
| 语音交互要接入已经存在的文本 Agent 或后端服务 | GPT-Live | 可把会话体验和后端工作分开，并让用户在后端运行时继续交流 |
| 必须在回复前保存或审核转写文本 | 分阶段语音管线 | 应用能检查文本中间结果，并决定是否继续到回答与语音生成 |

## 观察练习

为每种需求选一个工作流，并说明“用户输入什么、应用得到什么”：

| 场景 | 你的选择 |
| --- | --- |
| 把一篇说明文生成可下载的 MP3 | 待填写 |
| 新闻播报音频可以边生成边播放 | 待填写 |
| 用户说“帮我查订单”，助手正在查询时用户又补充订单号 | 待填写 |
| 在生成语音回复前，业务规则要求先检查完整转写稿 | 待填写 |

再用一句话解释：为什么 Speech API 的流式音频输出不等于 Realtime 会话？

## 本课检查

完成本课后，能解释：

- TTS 是有界的“文字到音频”生成任务；语气指令、声音和输出格式影响结果。
- TTS 流式传输让音频可以更早开始播放，但不会自动监听用户、检测轮次或保存会话状态。
- Realtime API 提供持续的音频会话，能管理输入、输出、轮次、对话状态和打断；连接方式要按客户端/服务端场景选择。
- GPT-Live 适合把全双工语音界面接到独立后端；分阶段语音管线适合需要检查中间文字的应用。
- 官方当前将旧 Speech API 模型标为弃用；迁移到 Realtime API 是架构调整，不是替换一个模型字符串。

## 简化与边界

- 本课仅介绍 TTS 请求形状与语音 Agent 的架构选择；不展开 Realtime 事件协议、WebRTC SDP 交换、音频采样率、VAD 参数和工具授权实现。
- TTS 代码使用官方文档中的旧模型标识来展示既有接口；模型状态和关闭日期以当前弃用公告为准。
- 实时示例假设应用服务器已安全创建临时凭证，且浏览器运行环境满足麦克风权限与连接要求；本课没有实际连接会话或生成音频。
