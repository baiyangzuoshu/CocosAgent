# 第 15 课：语音转文字与音频理解

**目标：** 能根据任务选择转写接口或直接音频输入；看懂文件转写与 Chat Completions 音频输入的最小 TypeScript 结构，并分清已录制文件与实时音频。

## 本课问题

手里有一段录音时，什么时候先把语音变成文字，什么时候直接让支持音频的模型理解录音并回答问题？

## 前置知识

- [第 4 课](../s04_prompt_instructions_roles/README.md)：把任务和输出要求写清楚。
- [第 7 课](../s07_first_responses_request/README.md)：SDK 与 API 请求的基本结构。
- [第 14 课](../s14_file_inputs_pdf_file_search/README.md)：文件作为模型输入与专用处理工作流的区别。

## 官方资料

- [File transcription](https://developers.openai.com/api/docs/guides/speech-to-text)：查看推荐的文件转写模型、上传要求、上下文提示和流式转写。
- [Transcription workflow](https://developers.openai.com/api/docs/guides/transcription)：比较已录制文件和实时转写，了解质量评估方法。
- [Audio in Chat Completions](https://developers.openai.com/api/docs/guides/audio-chat-completions)：查看如何把音频与文字任务一起发给音频模型。
- [GPT-Audio-1.5 model](https://developers.openai.com/api/docs/models/gpt-audio-1.5)：核对模型的音频能力和支持的端点。
- [Create chat completion reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)：查 `input_audio`、音频格式和输出模态字段。

## 1. 先问清楚要得到什么

语音任务有两种常见结果：

| 需求 | 处理方式 | 典型输出 |
| --- | --- | --- |
| 需要一份可以校对、存档、搜索或交给后续程序处理的文字稿 | `audio.transcriptions.create`，使用 `gpt-transcribe` | 转写文本 |
| 需要总结录音、回答录音里的问题，或直接按录音内容完成任务 | Chat Completions + 音频输入模型，例如 `gpt-audio-1.5` | 模型对文字指令的回答 |

第一种明确要求把“说了什么”转换为文字。第二种让模型在一次请求里接收音频和文字任务；应用不需要先自行调用转写接口，再把文本送去另一个模型请求。需要在自己的程序里保存、搜索或审查逐字稿时，转写接口通常更直接。

## 2. 已录制音频转写：`gpt-transcribe`

文件转写使用 `/v1/audio/transcriptions`。官方指南推荐新接入从 `gpt-transcribe` 开始；Node.js SDK 的最小形式如下：

```ts
import { createReadStream } from "node:fs";
import OpenAI from "openai";

const client = new OpenAI();

const transcription = await client.audio.transcriptions.create({
  file: createReadStream("./meeting.wav"),
  model: "gpt-transcribe",
});

console.log(transcription.text);
```

如果录音包含专有名词，可加上与录音相关的 `prompt`、`keywords` 或已知输入语言 `languages`。它们是识别上下文或提示，不是强制输出；例如，不要把并未在录音中说出的关键词当成希望模型补进文字稿的内容。[File transcription：prompting](https://developers.openai.com/api/docs/guides/speech-to-text)

官方文件转写指南列出的单个音频文件上限为 25 MB，支持 MP3、MP4、MPEG、MPGA、M4A、WAV 和 WebM。调用前还要确认文件本身可读、格式元数据正确，并在代表性的语言、口音、噪声、姓名、数字和专业词汇上评估结果。

## 3. 直接让模型处理音频

如果任务是“概括这段录音”或“回答录音里提到的问题”，可以把文字指令和 `input_audio` 放在同一条用户消息里。下面示例让模型只返回文字：

```ts
import { readFile } from "node:fs/promises";
import OpenAI from "openai";

const client = new OpenAI();
const audio = await readFile("./meeting.wav");

const completion = await client.chat.completions.create({
  model: "gpt-audio-1.5",
  modalities: ["text"],
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "用三句话总结录音，并列出说话者提出的问题。只根据录音回答。",
        },
        {
          type: "input_audio",
          input_audio: {
            data: audio.toString("base64"),
            format: "wav",
          },
        },
      ],
    },
  ],
  store: false,
});

console.log(completion.choices[0]?.message.content);
```

`input_audio.data` 是 Base64 编码的音频字节；当前 Chat Completions API Reference 列出的音频输入格式是 `wav` 或 `mp3`。`modalities` 控制模型返回什么，示例只请求 `text`，所以没有设置音频输出的 `audio` 参数。若应用也需要语音回答，再按音频指南配置音频输出；语音生成的细节留到下一课。[Audio in Chat Completions](https://developers.openai.com/api/docs/guides/audio-chat-completions)、[Create chat completion reference](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)

这类调用与 Responses API 的文字或图片输入示例不同。当前官方音频指南的这一路径使用 Chat Completions；选 API 时应跟随具体能力的官方指南和模型页，不要只因为前面课程主要用 Responses API，就把不同端点的输入结构混用。

## 4. 已录制文件、流式结果与实时输入

- **完整录音文件：** 上传至文件转写接口，取得最终文字稿。
- **完整录音文件，但想边处理边看到文字：** 文件转写可以开启 `stream`，逐步返回转写事件。这仍然是处理一个已完成文件。
- **麦克风或电话音频正在持续到达：** 使用实时转写工作流；不要把文件接口的 `stream` 理解成实时音频会话。
- **需要模型与用户进行完整的实时语音对话：** 属于会话、轮次和语音回复设计，和实时转写有区别，下一课再展开。

官方转写指南推荐完成文件使用 `gpt-transcribe`，实时转写使用 `gpt-live-transcribe`。即使输出都可能逐段出现，输入是已上传文件还是不断到达的实时音频，仍会决定应使用哪个工作流。[Transcription workflow](https://developers.openai.com/api/docs/guides/transcription)

## 5. 识别质量与模型状态

转写质量应在真实音频条件下核验，而不是只用安静、清晰的一段样例。重点抽查目标语言和口音、背景噪声、电话音质、人名、数字、日期、字母数字串、领域术语、短句、长录音和被打断的语音。按应用的风险选择错误指标；例如业务单号是否正确，可能比总体字错率更重要。[Transcription workflow：test with representative audio](https://developers.openai.com/api/docs/guides/transcription)

截至 2026-11-10，官方文档推荐新文件转写接入使用 `gpt-transcribe`，并将 `whisper-1`、`gpt-4o-transcribe` 等旧集成标为弃用，安排于 2027-02-26 关闭。模型和接口状态可能变化；实施时重新查看当前指南与[弃用公告](https://developers.openai.com/api/docs/deprecations)。

## 观察练习

给每个场景选路，并说明所需结果：

| 场景 | 你的选择 |
| --- | --- |
| 访谈结束后，需要一份可校对的逐字稿 | 待填写 |
| 上传一段录音，询问“讲话者最后提出了哪两个问题？” | 待填写 |
| 麦克风持续收音，需要字幕随着讲话逐步出现 | 待填写 |
| 已录好的文件开启 `stream: true`，是否意味着它是 Realtime 会话？ | 待填写 |

## 本课检查

完成本课后，能解释：

- 需要文字稿时，使用文件转写接口与推荐模型 `gpt-transcribe`。
- 需要直接询问录音内容时，可用音频输入能力，把文字任务与 `input_audio` 一起发给音频模型。
- `input_audio` 和 `audio.transcriptions.create` 是两种不同的请求工作流；音频内容并不是 Responses API 的 `input_file`。
- 对完整录音文件开启流式输出，不会自动变成实时麦克风输入；实时转写需要实时工作流。
- 关键词等上下文是提示，转写结果仍需根据实际音频场景评估。

## 简化与边界

- 示例只演示最小文件转写和一次有界音频问答，不展开多轮音频对话、工具调用、说话人分离、字幕时间戳或翻译。
- 示例假设服务器环境中已经配置 SDK 和 API Key；没有上传音频或实际发送 API 请求。
- 音频模型端点、支持格式、上传大小与参数会变化，实际实现以当前模型页和 API Reference 为准。
