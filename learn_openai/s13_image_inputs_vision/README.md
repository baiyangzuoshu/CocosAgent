# 第 13 课：模型怎样接收和理解图片

**目标：** 能把图片与文字一起放进 Responses API 输入，选择 URL、Base64 或 File ID 传图方式，并根据任务选 `detail` 档位、识别图像理解的主要限制。

## 本课问题

怎样把一张图片提供给模型？模型看到原始图片吗？读图、识别小字和精确定位时应该注意什么？

## 前置知识

- [第 7 课](../s07_first_responses_request/README.md)：Responses API 最小请求。
- [第 8 课](../s08_responses_request_response/README.md)：请求输入与响应输出结构。
- [第 3 课](../s03_tokens_context_window/README.md)：Token 和上下文窗口。

## 官方资料

- [Images and vision](https://developers.openai.com/api/docs/guides/images-vision?api-mode=responses)：查看 Responses API 的图片输入方式、`detail`、支持格式与视觉限制。
- [Create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create)：查阅 `input_image` 的 `image_url`、`file_id` 和 `detail` 字段。
- [Image input cost calculator](https://developers.openai.com/api/docs/guides/image-cost-calculator)：按模型、图片尺寸和细节档位估算图片输入 Token 与费用。

## 1. 图片作为消息内容的一部分

在 Responses API 中，图片作为 `input_image` 内容项放进用户消息的 `content` 数组。文字和图片可以在同一条消息里：

```ts
const response = await client.responses.create({
  model: "gpt-6-astra",
  input: [
    {
      role: "user",
      content: [
        { type: "input_text", text: "描述这张图片中的主要场景。" },
        {
          type: "input_image",
          image_url: "https://example.com/photo.jpg", // 替换为 API 可访问的图片 URL
          detail: "high",
        },
      ],
    },
  ],
});

console.log(response.output_text);
```

在结构上，`input_text` 写问题或任务，`input_image` 提供视觉输入。这里调用的是能处理视觉输入的模型；这是图片理解，不是生成或编辑图片的 Image API 工作流。[Images and vision](https://developers.openai.com/api/docs/guides/images-vision?api-mode=responses)

## 2. 三种传图方式

| 方式 | 常见用途 | 要点 |
| --- | --- | --- |
| 图片 URL | 图片已放在 API 可访问的 HTTPS 地址 | API 必须能取得该地址的图片内容；用户本地路径不是 URL |
| Base64 Data URL | 程序已经在内存中拿到图片字节 | 把媒体类型和 Base64 内容组成 `data:image/jpeg;base64,...` |
| File ID | 先用 Files API 上传，再在一个或多个请求中引用 | 上传图片时指定 `purpose: "vision"`，请求传 `file_id` |

Data URL 的输入形状示意：

```ts
{
  type: "input_image",
  image_url: "data:image/jpeg;base64,<BASE64_IMAGE_DATA>",
}
```

File ID 的输入形状示意（`file_...` 是此前上传得到的 ID）：

```ts
{
  type: "input_image",
  file_id: "file_...",
}
```

图片可通过完整 URL、Base64 Data URL 或 Files API 的 File ID 提供。可在同一条 `content` 数组放多张图片，但每张图片都计入输入用量。[Images and vision](https://developers.openai.com/api/docs/guides/images-vision?api-mode=responses)

## 3. `detail` 控制图像预处理

`detail` 有 `low`、`high`、`original` 和 `auto` 等值；支持的选项与图像缩放行为取决于模型，省略时通常使用 `auto`。

| 档位 | 大致用途 | 留意事项 |
| --- | --- | --- |
| `low` | 粗略场景理解、对细节要求较低 | 具体缩放和 Token 用量随模型变化；不能一概认为它比 `high` 更省 Token |
| `high` | 一般的高细节图像理解 | 图片仍可能按模型的像素或 patch 限制缩放 |
| `original` | 密集细节、空间敏感或计算机使用图像（模型支持时） | 不表示图片永远未经缩放；模型仍有尺寸和 patch 上限 |
| `auto` | 让模型采用默认的图像处理策略 | 用量和预处理受模型策略影响 |

OCR、小物体识别或精确坐标任务可能需要更高细节；如果模型支持，可考虑 `original`，并在必要时自行裁切或放大目标区域。坐标敏感任务还要把图像缩放和返回坐标映射关系考虑清楚。[Images and vision：Choose an image detail level](https://developers.openai.com/api/docs/guides/images-vision?api-mode=responses)

图片会被转换为模型输入 Token，并计入上下文、TPM 和费用。实际图像 Token 用量受模型、尺寸、`detail` 和缩放规则共同影响，估算时查看[图片输入费用计算器](https://developers.openai.com/api/docs/guides/image-cost-calculator)，不要只凭压缩文件大小判断费用。[Images and vision：Calculating costs](https://developers.openai.com/api/docs/guides/images-vision?api-mode=responses)

## 4. 格式、尺寸与图像质量限制

官方图片输入指南列出的常见支持格式是 PNG、JPEG/JPG、WEBP 和非动画 GIF。当前通用指南还列出每个请求的总载荷和图片数量上限；具体模型的像素、patch 与输入限制可能更严格，大图可能会被缩放或直接拒绝。以当前模型指南中的限制为准。[Images and vision：Image input requirements](https://developers.openai.com/api/docs/guides/images-vision?api-mode=responses)

视觉模型可能误读图片。实际设计中尤其要留意：

- **小字和密集文字：** 字号太小会降低识别效果；放大或裁切后再发送，必要时选高细节。
- **旋转或倒置内容：** 文字方向异常会造成误读。
- **非拉丁文字：** 某些文字体系在图片中的识别表现可能较弱。
- **图表颜色和样式：** 仅靠颜色、虚实线或细微样式区分的数据可能被混淆。
- **定位和计数：** 精确空间位置与物体数量可能只是近似结果。
- **全景或鱼眼图：** 特殊视场形状会增加理解难度。
- **医学图像：** 不适合用于解释 CT 等专门医学影像或给出医疗建议。

模型也可能在图片描述和图中文字识别上出错；对重要业务结论应设计人工复核或其他验证方式。[Images and vision：Limitations](https://developers.openai.com/api/docs/guides/images-vision?api-mode=responses)

## 观察练习

为下列任务选择一种传图方式和 `detail`，并说明还要防范什么错误：

| 任务 | 你的选择 |
| --- | --- |
| 对公开产品图片做大致场景描述 | 待填写 |
| 上传本地发票照片并识别小号文字 | 待填写 |
| 读取包含细小坐标的界面截图 | 待填写 |

然后解释：把 `detail` 设为 `original` 是否保证图片完全不被缩放？

## 本课检查

完成本课后，能解释：

- 图片通过 `input_image` 与文字一起放进用户消息内容。
- 可用 API 可访问 URL、Base64 Data URL 或 Files API File ID 传图。
- `detail` 控制模型对输入图片的预处理策略；选项和缩放限制取决于模型。
- 图像输入消耗 Token；尺寸、细节和模型都会影响用量。
- 视觉理解可能误读文字、颜色、位置、计数和特殊视场；高风险结果需要复核。

## 简化与边界

- 示例关注 Responses API 的单轮图像输入，不展开 PDF/文件输入、图像生成、视频帧或实时视觉。
- 支持格式、数量、载荷、像素和 patch 上限可能按模型变化；示例不替代当前模型页的限制表。
- `detail: "original"` 不代表原始文件保证原样送进模型。
- 本课没有实际发送 API 请求。
