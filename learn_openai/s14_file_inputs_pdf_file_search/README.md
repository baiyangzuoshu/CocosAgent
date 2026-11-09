# 第 14 课：把文件和 PDF 提供给模型

**目标：** 能区分把文件直接加入本次 Responses 输入，与在向量库中检索文件内容；理解 PDF 页图、普通文档文本和 File Search 的基本处理路径。

## 本课问题

要让模型阅读一份文件，何时直接把文件交给请求？何时更适合先建立知识库，再按问题搜索相关内容？

## 前置知识

- [第 7 课](../s07_first_responses_request/README.md)：Responses API 的最小请求。
- [第 8 课](../s08_responses_request_response/README.md)：读取 `output` 项和响应状态。
- [第 13 课](../s13_image_inputs_vision/README.md)：图片输入、视觉处理与图片 Token。

## 官方资料

- [File inputs](https://developers.openai.com/api/docs/guides/file-inputs)：查看 Responses API 的 `input_file`、文件格式和大小限制。
- [File Search](https://developers.openai.com/api/docs/guides/tools-file-search)：查看向量库、文件索引和 Responses API 内置检索工具。
- [Retrieval](https://developers.openai.com/api/docs/guides/retrieval)：了解向量库怎样切分、嵌入和索引文件。
- [Create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create)：查询 `input_file` 的 `file_id`、`file_data`、`file_url` 和 `detail` 字段。

## 1. 直接文件输入：本次请求就附上要读的文件

Responses API 的 `input_file` 可以与问题文字一起放在用户消息里。常见做法是先用 Files API 上传，再在请求中引用上传结果的 ID：

```ts
import fs from "node:fs";
import OpenAI from "openai";

const client = new OpenAI();

const file = await client.files.create({
  file: fs.createReadStream("./report.pdf"),
  purpose: "user_data",
});

const response = await client.responses.create({
  model: "gpt-6-astra",
  input: [
    {
      role: "user",
      content: [
        { type: "input_text", text: "总结报告的三项主要结论。" },
        { type: "input_file", file_id: file.id, detail: "high" },
      ],
    },
  ],
});

console.log(response.output_text);
```

上传时 `purpose: "user_data"` 适合计划作为模型输入的文件。也可以直接提供 Base64 文件数据，或使用 API 可访问的文件 URL；一次请求可以附上多个文件。[File inputs](https://developers.openai.com/api/docs/guides/file-inputs)

## 2. PDF、文档和表格的处理并不相同

| 输入文件 | Responses API 处理方式 | 需要留意 |
| --- | --- | --- |
| PDF | 在支持视觉的模型上，同时提取文字并处理页面图像 | 图表、小字和页面布局会增加视觉输入量 |
| Word、PowerPoint、文本和代码文件 | 主要提取文字 | 非 PDF 中的内嵌图片、图表不会按视觉内容送给模型 |
| Excel、CSV 等表格 | 走表格专用的增强处理流程 | 大型聚合、连接和计算任务需要相应的数据分析方案 |

PDF 的 `detail` 可选 `auto`、`low` 或 `high`，默认是 `auto`；它控制 PDF 页面图像的处理细节，提取出来的 PDF 文字仍会包含在模型上下文中。细小图表或打印字需要更多视觉细节时可考虑 `high`，但这会影响输入 Token 使用量。[File inputs：PDF detail levels](https://developers.openai.com/api/docs/guides/file-inputs)

若 DOCX 或 PPTX 里的图表、截图很重要，直接文件输入可能只有文字内容。可以把相关页面转成 PDF，或将关键图像作为单独图片输入。[File inputs：Non-PDF image and chart limitations](https://developers.openai.com/api/docs/guides/file-inputs)

## 3. 单次请求文件的常见限制

当前官方 File Inputs 指南列出的 Responses API 常见格式包括 PDF、DOC/DOCX/RTF/ODT、PPT/PPTX、CSV/XLS/XLSX，以及多种文本和代码文件。指南还规定单个文件小于 50 MB，单次请求内所有文件合计不超过 50 MB；实际可用类型及模型限制以当前官方列表为准。[File inputs：Accepted file types and usage considerations](https://developers.openai.com/api/docs/guides/file-inputs)

直接文件输入适合“这次请求要读这份文件”。即使复用上传后的 File ID，也需要在每次要读取时把该文件作为 `input_file` 加进请求；它不会自动变成跨请求可检索的知识库。PDF 的页图和文字都可能计入上下文，较大的文档要留意 Token、上下文窗口与成本。

## 4. File Search：先建知识库，再检索相关内容

如果应用要对一批文件反复回答问题，可以把文件上传并加入 Vector Store。文件加入后会被切分、嵌入和索引；Responses API 的 File Search 工具会根据问题检索相关片段，再交给模型生成回答。[File Search](https://developers.openai.com/api/docs/guides/tools-file-search)、[Retrieval](https://developers.openai.com/api/docs/guides/retrieval)

完成 Vector Store 建立和文件索引后，请求可以这样使用 File Search：

```ts
const response = await client.responses.create({
  model: "gpt-6-astra",
  input: "根据公司报销指南，出差餐费需要哪些凭证？",
  tools: [
    {
      type: "file_search",
      vector_store_ids: ["vs_..."],
    },
  ],
});

console.log(response.output_text);
```

File Search 是由 OpenAI 托管的 Responses 工具；响应中会出现 `file_search_call` 项，回答消息可带文件引用。应用可以检查这些项目与引用，确认回答依据了哪些文件内容。[File Search](https://developers.openai.com/api/docs/guides/tools-file-search)

## 5. 选直接输入还是 File Search

| 情况 | 更合适的起点 | 原因 |
| --- | --- | --- |
| 用户本轮临时上传一份 PDF，并要求总结指定章节 | 直接 `input_file` | 这份文件本身就是本次任务上下文 |
| 用户每次都在问公司知识库，文件数量多且会更新 | File Search | 先建立可重复检索的索引，每次请求只找相关内容 |
| 需要对一个完整小文档进行全面改写或逐段分析 | 直接文件输入 | 应用明确要求模型处理这份完整文件 |
| 需要从大量材料中回答某个具体问题 | File Search | 检索有助于从资料集合中找到相关片段 |

File Search 返回的是检索到的相关片段，不应默认它已完整读过知识库中的每个文件。若任务要求全文覆盖、准确逐页总结或跨多个文件穷尽比对，应明确设计检索与核验流程；第 18 课会进一步展开 Vector Store、File Search 和 RAG。

## 观察练习

为每项任务选一种方式，并说明为什么：

| 任务 | 你的选择 |
| --- | --- |
| 用户刚上传一份 20 页 PDF，只问这份合同里的付款期限 | 待填写 |
| 客服每天回答数千份产品手册中的常见问题 | 待填写 |
| PPT 文件里的流程图比演讲者备注更重要 | 待填写 |

再回答：直接传入 PDF 时，`detail: "low"` 会不会删除 PDF 中可提取的文字？为什么？

## 本课检查

完成本课后，能解释：

- `input_file` 把文件作为本次 Responses 请求的一部分；File Search 先在 Vector Store 建索引，再按查询检索相关片段。
- PDF 在支持视觉的模型上会同时提供提取文字和页面图像；`detail` 只控制页面图像细节。
- 非 PDF 文档主要抽取文字，嵌入图片和图表不会自动作为视觉输入。
- File Search 适合大量、重复检索的资料；它不是自动穷读所有文件的全文总结器。
- 文件大小、支持格式、PDF 页图和检索片段都会影响限制、Token 用量和成本。

## 简化与边界

- 本课使用 PDF 和知识库问答作为主要示例，不展开向量库过滤、检索排名、引用 UI 和文件生命周期管理。
- 表格文件有专门的解析与增强流程；复杂统计或计算不属于本课的普通文档问答。
- 支持格式、文件大小与视觉处理规则可能随 API 更新，调用前以当前官方文档为准。
- 本课没有实际上传文件或发送 API 请求。
