# 第 19 课：图像生成怎样返回图片，视频生成 API 当前是什么状态？

**目标：** 能区分 Image API 与 Responses API 图像生成工具的请求和返回结构；能将 Base64 图片结果保存为文件；能通过官方弃用资料判断视频生成接口是否仍可调用。

## 本课问题

OpenAI API 生成图片时，图片数据出现在什么位置？如果官方文档还留有 Sora 视频接口的代码，它现在还能调用吗？

## 前置知识

- [第 7 课](../s07_first_responses_request/README.md)：发出 Responses API 请求。
- [第 8 课](../s08_responses_request_response/README.md)：读取响应对象。
- [第 13 课](../s13_image_inputs_vision/README.md)：图片作为模型输入与生成图片作为输出的区别。

## 官方资料

- [Image generation](https://developers.openai.com/api/docs/guides/image-generation)：查看 Images API、图像编辑、输出参数与结果。
- [Image generation tool](https://developers.openai.com/api/docs/guides/tools-image-generation)：查看 Responses API 工具调用、工具结果和多轮编辑。
- [Create image](https://developers.openai.com/api/reference/resources/images/methods/generate)：核对 `/v1/images/generations` 的请求和返回字段。
- [Models](https://developers.openai.com/api/docs/models) 与 [Deprecations](https://developers.openai.com/api/docs/deprecations)：核对模型可用性和生命周期。
- [Video generation with Sora](https://developers.openai.com/api/docs/guides/video-generation)：本课查阅时已标为历史参考；结合 [弃用公告](https://developers.openai.com/api/docs/deprecations)确认视频 API 状态。

## 1. 图像生成有两种常见调用入口

如果任务是“一次提示，返回一张或多张图片”，可以直接用 Images API。生成新图使用 `images.generate`；根据已有图片继续修改则使用 `images.edit`。

如果图片生成要放进多轮对话或更长的模型流程，可以用 Responses API 的 `image_generation` 内置工具。顶层 `model` 负责对话与工具选择，工具的 `model` 字段选择图像模型；响应会把生成结果作为一个 `image_generation_call` 输出项。

| 调用入口 | 请求方式 | 典型返回 | 适合的任务 |
| --- | --- | --- | --- |
| Images API | `client.images.generate(...)` 或 `client.images.edit(...)` | `data[]`，GPT Image 常以 `b64_json` 返回图片字节 | 单次生成或编辑图片 |
| Responses API | `client.responses.create(...)` 加 `image_generation` 工具 | `output[]` 中的 `image_generation_call`，其 `result` 是 Base64 图片 | 对话式创作、多轮编辑、与其他模型步骤结合 |

同样是“生成图片”，两种入口的响应类型不同：不能把 Responses API 的 `output_text` 当作图片内容，也不能把 Images API 的 `data[0].b64_json` 当成 Responses 输出项。[Image generation](https://developers.openai.com/api/docs/guides/image-generation)、[Image generation tool](https://developers.openai.com/api/docs/guides/tools-image-generation)

## 2. 用 Images API 生成并保存图片

下面用 TypeScript SDK 发出一次图片生成请求，并把返回的 Base64 解码成 PNG 文件。模型 ID、尺寸和可用参数以当前模型页面及 API Reference 为准；示例中的 `gpt-image-2.5-flare` 只展示请求结构。

```ts
import { writeFile } from "node:fs/promises";
import OpenAI from "openai";

const client = new OpenAI();

const result = await client.images.generate({
  model: "gpt-image-2.5-flare",
  prompt: "画一张儿童绘本风格的插画：兽医用听诊器给一只小水獭检查心跳，温暖柔和的色彩。",
  n: 1,
  size: "1024x1024",
  output_format: "png",
});

const imageBase64 = result.data?.[0]?.b64_json;
if (!imageBase64) {
  throw new Error("响应中没有图片数据");
}

await writeFile("otter.png", Buffer.from(imageBase64, "base64"));
```

响应里的 `data` 是生成图片列表，`b64_json` 是图片字节的 Base64 表示。程序要先 Base64 解码，才能把内容写成 PNG 等图片文件；选择的 `output_format` 要与文件扩展名一致。`size`、`quality`、`background`、压缩方式和 `n` 等选项会影响输出，但可用组合由所选模型决定。[Create image](https://developers.openai.com/api/reference/resources/images/methods/generate)

## 3. 在 Responses API 中调用图像生成工具

Responses API 适合需要对图片继续对话或修改的流程。以下请求让模型调用图像生成工具，然后从响应输出项中找到图片结果：

```ts
import { writeFile } from "node:fs/promises";
import OpenAI from "openai";

const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-6-astra",
  input: "生成一张灰色虎斑猫抱着戴橙色围巾的水獭的插画。",
  tools: [{ type: "image_generation", model: "gpt-image-2.5-flare" }],
  tool_choice: { type: "image_generation" },
});

const images = response.output.flatMap((item) =>
  item.type === "image_generation_call" ? [item.result] : [],
);
const imageBase64 = images[0];
if (!imageBase64) {
  throw new Error("响应中没有图像生成结果");
}

await writeFile("cat-and-otter.png", Buffer.from(imageBase64, "base64"));
```

`image_generation_call.result` 是 Base64 图片数据；响应还可能包含普通消息等其他输出项，所以先按 `type` 找到图像工具结果。要继续修改，可以延续 Responses 对话状态或传入 `previous_response_id`，并在新请求中描述“改哪里、保留什么”。Responses 工具也支持图片输入；它会把生成或编辑纳入同一对话流程。[Image generation tool：Usage](https://developers.openai.com/api/docs/guides/tools-image-generation)

## 4. 视频生成：读懂历史请求与当前状态

**截至 2026-11-10，OpenAI 官方文档明确说明：Sora 2 模型和 Videos API 已于 2026-09-24 关闭，没有一对一替代 API；视频生成指南仅保留作历史参考。** 因此，不能把指南中仍可见的代码当成当前可执行示例。[Video generation with Sora](https://developers.openai.com/api/docs/guides/video-generation)、[Deprecations](https://developers.openai.com/api/docs/deprecations)

旧版 Videos API 是异步任务模式，读它可以练习识别输入输出关系，但不应再照此发请求：

```text
POST /v1/videos
  → 返回视频任务对象：id、status、progress、size、seconds
GET /v1/videos/{video_id}
  → 查询任务状态，或由 webhook 通知完成
GET /v1/videos/{video_id}/content
  → 任务成功后取回 MP4 内容
```

这里的第一份响应不是 MP4 文件，而是带 `id` 和 `status` 的任务记录。生成完成后，才有单独的内容下载步骤。如今该接口已关闭；如果要使用 OpenAI 视频生成能力，应重新检查官方 Models、Changelog 与 Deprecations，不能假设旧 API 有新名称或兼容替代。

## 5. 图片输入、图片输出与提示描述

第 13 课讲模型读取图片；本课的生成接口则把图片作为输出。编辑任务还可以提供已有图片作为参考，并用提示描述要修改什么、哪些部分要保留。对于遮罩或标注图，应把它们视为引导信号；模型生成结果仍需检查，不要假设编辑边界一定像素级精确。[Image generation](https://developers.openai.com/api/docs/guides/image-generation)

提示词可以按这些维度写清楚：

- 主体与动作：画面里是谁或什么，在做什么。
- 构图与视角：主体位置、镜头远近、视角和留白。
- 风格与光线：媒介风格、色彩、时间和照明。
- 约束与保留项：需要出现的文字、数量、比例，以及编辑时必须维持的细节。

## 选择练习

为每个场景选入口，并说明你会从哪一个返回字段取图片或判断状态：

| 场景 | 选择 |
| --- | --- |
| 用户给一句话，只需要一次生成并保存图片 | 待填写 |
| 用户先生成海报，再连续要求换配色、改标题 | 待填写 |
| 项目里有旧的 `POST /v1/videos` 请求，准备接入新服务 | 待填写 |
| 应用需要展示生成图片的尺寸、格式并写入文件 | 待填写 |

## 本课检查

完成本课后，能解释：

- Images API 返回 `data[]` 中的图片数据；GPT Image 通常以 `b64_json` 返回，程序需解码后才能保存。
- Responses API 通过 `image_generation` 工具生成图片，结果位于 `image_generation_call.result`，并可用于对话式编辑。
- 图像输入、图像生成输出和视频文件输出是不同的输入输出契约。
- 截至 2026-11-10，Sora 2 和 OpenAI Videos API 已关闭；文档中的端点和示例只适合理解历史任务流程。
- 接入前要检查当前模型列表、弃用公告、组织访问要求与所选模型支持的输出参数。

## 简化与边界

- 示例只演示生成图片与读取 Base64 结果，不包含图片上传编辑、遮罩、流式部分图、文件存储策略或前端展示。
- 图片模型示例用于解释 SDK 结构；模型 ID、参数和访问资格可能变化，应在实际开发时复核官方文档。
- 视频 API 部分仅讲官方留存的历史接口形状和停用状态，没有可执行的视频生成请求；产品状态以授课时重新核对的官方公告为准。
