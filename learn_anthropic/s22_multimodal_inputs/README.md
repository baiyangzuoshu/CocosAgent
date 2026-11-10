# 第 22 课：图片、文件和其他输入能力如何进入请求？

**目标：** 能在 Messages 请求中组织文本、图片、PDF 和其他文件输入，选择合适的内容块与文件来源，并核对模型、平台、大小和数据处理限制。

## 本课问题

普通文本之外，Claude API 如何接收图片和文件？哪些内容适合放在 text、image 或 document 内容块中？使用 Files API 上传文件后，file_id 的访问范围和生命周期是什么？

## 官方资料

- [Using the Messages API](https://platform.claude.com/docs/en/build-with-claude/working-with-messages)：消息内容块与图像输入示例。
- [Vision](https://platform.claude.com/docs/en/build-with-claude/vision)：图像来源、格式、分辨率、限制和费用。
- [PDF support](https://platform.claude.com/docs/en/build-with-claude/pdf-support)：PDF 的输入形式、解析方式、请求限制和平台支持。
- [Files API](https://platform.claude.com/docs/en/build-with-claude/files)：上传后复用文件、file_id 权限范围、生命周期和其他文件格式。
- [Create a Message API Reference](https://platform.claude.com/docs/en/api/messages/create)：Messages 内容块与输入来源类型。

核对日期：2026-11-10。模型、平台、文件大小、上下文容量和输入方式会变化；发送前应按官方兼容性和限制表核对目标平台。

## 1. 多模态输入仍放在消息 content 中

Messages 请求的每条消息都有 role 和 content。简单文本可以直接写成字符串；当一条消息需要混合说明文字和图像或文档时，content 使用有序内容块数组。图像和 PDF 通过各自类型的内容块传入，不是把文件路径直接写进普通文本就能读取。

    {
      "role": "user",
      "content": [
        {"type": "text", "text": "请描述图片，并从报告中找出相关结论。"},
        {
          "type": "image",
          "source": {
            "type": "base64",
            "media_type": "image/jpeg",
            "data": "[base64 编码的图像数据]"
          }
        },
        {
          "type": "document",
          "source": {"type": "url", "url": "https://example.com/report.pdf"}
        }
      ]
    }

这里的 URL 和 base64 只是两种输入来源示意；本机路径、未经授权的私有 URL 或任意上传文件并不会自动变成 Claude 可访问的消息内容。

## 2. 图片：image 内容块与来源类型

图像使用 type 为 image 的内容块。当前 Vision 指南列出三种来源：将图像数据内嵌为 base64、提供在线图片 URL，或通过 Files API 上传后引用 file_id。支持 JPEG、PNG、GIF 和 WebP；动画图像不按动画理解，只使用第一帧。

| 来源 | 请求中引用什么 | 常见用途与注意点 |
| --- | --- | --- |
| base64 | media_type 与编码后的 data。 | 一次性本地图像，不依赖公开图片 URL；会增加请求体积。 |
| URL | 可访问的图片 URL。 | 已在线托管的图片；需确认目标平台允许这种来源。 |
| Files API | 返回的 file_id。 | 重复使用或减少反复编码；要按 workspace 管理文件权限。 |

可以在一条 user 消息里交错提供文字和多张图片；给图片加上“图片一”“图片二”等文字标签，有助于后续问题引用。图像尺寸会影响视觉 token 和成本，过大的图像可能被缩小处理；图片质量、方向和文字清晰度也会影响结果。Amazon Bedrock 与 Google Cloud 的托管模型当前在图像来源类型上有额外限制，例如只接受 base64。不同模型和平台的数量、尺寸、单图大小限制也可能不同，应以当前 Vision 页为准。[Vision](https://platform.claude.com/docs/en/build-with-claude/vision)

## 3. PDF：document 内容块

PDF 使用 type 为 document 的内容块。当前官方指南列出三种来源：在线 URL、base64 编码 PDF，或 Files API 的 file_id。PDF 处理会结合提取出的文本和页面图像，因此可以询问正文，也可以分析图表、表格或版面中的可视信息。

    {
      "type": "document",
      "source": {
        "type": "base64",
        "media_type": "application/pdf",
        "data": "[base64 编码的 PDF 数据]"
      }
    }

只用来处理一次的小 PDF 可直接以内嵌或 URL 形式提供；体积较大或需要在多次请求中复用时，可评估 Files API 的 file_id。当前 PDF 指南要求标准、未加密的 PDF；第一方 Claude API 单次请求上限列为 128 MB，但云平台上限可能不同；页面数上限为 600 页，使用小于 1M token 上下文窗口的请求时为 100 页。总请求体积还包括同一请求中的其他内容。PDF 输入也会消耗上下文 token，长文档应先估算预算。[PDF support](https://platform.claude.com/docs/en/build-with-claude/pdf-support)

## 4. 文本文件、数据集和 Files API

| 输入内容 | 建议的请求形态 | 说明 |
| --- | --- | --- |
| 小段文本、Markdown 或 CSV | 读取内容后放入 text 内容块。 | 简单且明确；消息请求包含实际文本。 |
| PDF 或纯文本文件，需要重复引用 | Files API 上传一次，再通过 document 内容块引用 file_id。 | 文件存储与 Messages 请求分开；查看文件的 expires_at 或自行删除。 |
| 常见图片需要重复引用 | Files API 上传后在 image 内容块引用 file_id。 | image 与 document 使用不同内容块类型。 |
| DOCX、XLSX 等 document 块不支持的格式 | 转换为纯文本后放进 text；若要做数据分析，可上传给 code execution 工具。 | container_upload 是交给代码执行环境的输入路径，不是通用的 Claude document 内容块。 |

Files API 的作用是上传并管理可复用文件。上传文件存放在 workspace 中，拥有该 workspace API 访问权的密钥都可能引用它；文件并不自动按终端用户、聊天或会话隔离。因此，应用应把 file_id 作为服务端引用维护，不要直接接受终端用户传来的任意 file_id。上传文件会持续存在到主动删除或设定的过期时间；Files API 当前不具备 ZDR 或 HIPAA 资格。内联 PDF Messages 请求的数据处理条件不同，需单独按该功能文档判断。[Files API](https://platform.claude.com/docs/en/build-with-claude/files)

## 5. 选择输入形式前的核对项

1. **内容类型：** 这是短文本、图像、标准 PDF，还是 document 块不支持的文件格式？选择对应的内容块，不要只附上本地文件名。
2. **来源类型：** 当前平台是否支持 base64、URL 和 file_id？部分云平台只支持部分来源；文件引用还取决于部署方式。
3. **大小与上下文：** 检查整个请求大小、文件页数、图片尺寸以及模型上下文窗口。文件上传上限不等于模型能一次处理同等大小的内容。
4. **访问和保留：** 确认 file_id 所属 workspace、文件删除或过期方式以及对应的数据处理资格。
5. **结果复核：** 图片中很小或模糊的文字、复杂图表和视觉定位可能产生错误；重要内容应检查原图并验证输出。

图像理解的数量、像素与 token 预算可能按模型和平台不同；PDF 同时占用文本与图像输入成本。需要精确估算时，先看 Vision/PDF 限制并使用 Messages API 的 token counting 能力，不要只根据文件字节数判断请求是否可处理。

## 练习：选一种合适的输入路径

应用要完成四项任务：比较两张 JPEG 图片；阅读一份带图表的 PDF；将用户上传的 XLSX 数据集做统计；从 CSV 中提取一列文字分类。请为每项选择内容块或工具输入方式，并指出一项访问或限制检查。

**参考答案：** 两张 JPEG 可作为同一 user 消息中的两个 image 内容块，并用文本标签说明顺序；图表 PDF 用 document 块，通过 URL、base64 或受支持的 file_id 传入；XLSX 数据集应使用 Files API 上传并通过 container_upload 提交给 code execution，而不是假设 document 块能读取 XLSX；CSV 若只是提取文字，可读出内容后作为 text，也可按 Files API 说明以 text/plain 放入 document 块。无论何种文件引用，都要核对目标平台、请求/上下文大小，并在服务端控制 workspace 范围内的 file_id。

## 本课结论

Messages API 将多模态输入放在消息的有序 content 块中：普通文字放 text，图片放 image，PDF 或纯文本文档放 document；Files API 可以上传后以 file_id 复用图片和文档，数据集则可通过 container_upload 交给代码执行工具。不同来源、平台、模型、大小、上下文预算和文件保留条件都有边界；选择输入路径时应按官方兼容性表逐项核对。

## 范围与时效

- 官方文档核对日期：2026-11-10。
- 本课说明 Messages API 的文本、图像、PDF、纯文本文件和代码执行文件输入；其他模态或产品路径以当前 API Reference 为准。
- 结构化输出见第21课；工具调用闭环见第20课；长期数据与生产环境管理见第28课。
