# 第 23 课：Code Interpreter 适合哪些文件与计算任务？

**目标：** 能配置 Responses API 的 Code Interpreter；能判断何时用托管 Python 处理计算或文件；能从响应中识别执行状态、运行输出和生成文件；理解容器的网络与生命周期边界。

## 本课问题

什么时候该把计算交给 Code Interpreter？输入文件怎样交给 Python，运行结果和生成文件又怎样取回？

## 前置知识

- [第 14 课](../s14_file_inputs_pdf_file_search/README.md)：了解上传文件与文件输入。
- [第 18 课](../s18_file_search_vector_stores_rag/README.md)：区分文件检索与计算处理。
- [第 20、21 课](../s20_function_calling_loop/README.md)：理解工具调用边界。
- [第 22 课](../s22_web_search/README.md)：区分公开网页搜索与沙箱计算。

## 官方资料

- [Code Interpreter](https://developers.openai.com/api/docs/guides/tools-code-interpreter)：查看使用场景、容器、文件输入与生成文件。
- [Using tools](https://developers.openai.com/api/docs/guides/tools)：了解 Responses API 的工具配置和模型工具选择。
- [Create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create)：核对 `tools`、`tool_choice` 和 `include`。
- [Get a model response](https://developers.openai.com/api/reference/resources/responses/methods/retrieve)：查看 `code_interpreter_call` 的状态、代码和运行输出字段。
- [Retrieve container file content](https://developers.openai.com/api/reference/resources/containers/subresources/files/subresources/content/methods/retrieve)：下载容器内的文件。
- [Create container](https://developers.openai.com/api/reference/resources/containers/methods/create)：查看容器内存、文件和网络策略配置。

## 1. 它解决什么问题

Code Interpreter 是 Responses API 的内置工具。模型可以在 OpenAI 管理的沙箱容器里编写并运行 Python，也可以在需要时多次修改代码、重新执行。它适合数据分析、数学计算、处理上传文件、生成表格或图像等任务。[Code Interpreter](https://developers.openai.com/api/docs/guides/tools-code-interpreter)

| 任务 | 合适的能力 | 主要工作 |
| --- | --- | --- |
| 汇总 CSV、计算统计值、生成图表 | Code Interpreter | 在托管 Python 容器中执行计算 |
| 从很多文档中查找相关段落 | File Search | 检索文件内容并提供相关片段 |
| 查今天公开发布的资料 | Web Search | 搜索互联网并返回来源 |
| 查询订单或提交退款 | Function Calling | 由应用执行受权限控制的业务逻辑 |

模型可以自动决定是否使用已配置的工具。默认 `tool_choice: "auto"` 时，它可能直接回答；若这项任务必须运行 Python，可设为 `tool_choice: "required"`。当请求只配置 Code Interpreter 时，`required` 要求调用这个可用工具。[Using tools](https://developers.openai.com/api/docs/guides/tools)

## 2. 配置 Code Interpreter 并处理文件

先把文件上传到 OpenAI Files API，然后将文件 ID 放进容器配置的 `file_ids`。下面让模型统计一个 CSV，并生成汇总文件和图表。`include` 用于把 Python 执行输出附在 `code_interpreter_call` 项目中，便于检查运行日志或图像输出。[Code Interpreter](https://developers.openai.com/api/docs/guides/tools-code-interpreter) · [Create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create)

```ts
import OpenAI from "openai";

const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-6-astra",
  instructions: "用 Python 检查数据后再回答；说明计算方法和主要发现。",
  tools: [
    {
      type: "code_interpreter",
      container: {
        type: "auto",
        memory_limit: "1g",
        file_ids: ["file-..."],
      },
    },
  ],
  tool_choice: "required",
  include: ["code_interpreter_call.outputs"],
  input:
    "使用 Python 工具读取提供的 sales.csv，按月份计算销售额，" +
    "生成 monthly_summary.csv 和一张折线图，并解释趋势。",
});

console.log(response.output_text);
console.dir(response.output, { depth: null });
```

`file_ids` 指已上传文件的 ID；单个自动容器最多可指定 50 个文件。模型输入中附带的文件也会自动提供给容器。示例假设文件已上传；`file-...` 是占位符，不是可直接调用的真实文件 ID。[Code Interpreter](https://developers.openai.com/api/docs/guides/tools-code-interpreter)

## 3. 在响应中检查执行和产物

响应的 `output` 是由多个项目组成的数组，执行过程和最终答复分开放置。下面是简化结构：

```json
[
  {
    "type": "code_interpreter_call",
    "id": "ci_example",
    "container_id": "cntr_example",
    "status": "completed",
    "code": "...Python source...",
    "outputs": [
      { "type": "logs", "logs": "...execution output..." }
    ]
  },
  {
    "type": "message",
    "role": "assistant",
    "content": [
      {
        "type": "output_text",
        "text": "汇总已完成。",
        "annotations": [
          {
            "type": "container_file_citation",
            "container_id": "cntr_example",
            "file_id": "cfile_example",
            "filename": "monthly_summary.csv"
          }
        ]
      }
    ]
  }
]
```

- `code_interpreter_call` 表示模型请求运行 Python。检查 `status`，并根据需要读取 `code`、`container_id` 和 `outputs`；`outputs` 可以包含日志或图像，调用 `include: ["code_interpreter_call.outputs"]` 后可请求这些数据。
- `message` 是模型给用户的答复；生成文件会通过 `container_file_citation` annotation 标出容器 ID、文件 ID 和文件名。
- 需要把产物保存到应用或交给用户时，用容器 ID 和文件 ID 调用 [Retrieve container file content](https://developers.openai.com/api/reference/resources/containers/subresources/files/subresources/content/methods/retrieve) 下载文件。`response.output_text` 是便捷的答复文本，不包含完整的工具运行记录或文件字节。[Code Interpreter](https://developers.openai.com/api/docs/guides/tools-code-interpreter) · [Get a model response](https://developers.openai.com/api/reference/resources/responses/methods/retrieve)

输出数组里的项目数量和顺序可能变化。不要把模型的文字结论当成计算日志或文件内容的替代品；需要审计时检查工具调用和产物本身。

## 4. 理解容器、内存和网络边界

- `container: { "type": "auto" }` 让 API 自动创建容器；在有先前 Code Interpreter 调用上下文时，自动模式也可能复用仍有效的容器。
- 需要显式管理容器时，可先调用 Containers API 创建容器，再将容器 ID 传给 Code Interpreter。
- 默认内存档位为 `1g`；当前文档列出 `1g`、`4g`、`16g` 和 `64g`。按任务需要选择，并在实施前核对最新的工具价格与限制。[Code Interpreter](https://developers.openai.com/api/docs/guides/tools-code-interpreter)
- 容器闲置 20 分钟后会过期，容器内数据随之删除。要保留输出文件，应及时下载并存到自己的存储中。
- 容器出站网络默认关闭。只有组织管理员配置允许的域名后，请求才能通过 `network_policy` 指定允许列表；不要为方便而开放不可信域名。[Create container](https://developers.openai.com/api/reference/resources/containers/methods/create) · [Shell：Network access](https://developers.openai.com/api/docs/guides/tools-shell)

Code Interpreter 是托管的短时计算环境，不是应用服务器或持久文件存储。高风险或关键业务结果应由应用校验；不要假设容器自动访问本机磁盘、任意互联网或公司内网。

## 5. 观察练习

判断下列任务是否适合 Code Interpreter，并说明需要检查哪项结果：

| 任务 | 你的选择 |
| --- | --- |
| 对 20 万行 CSV 按地区汇总并画图 | 待填写 |
| 在员工手册里找“育儿假”规定并引用原文 | 待填写 |
| 获取某公司今天发布的公告并给出链接 | 待填写 |
| 查询用户订单并提交退款 | 待填写 |
| Python 代码运行失败，但输出文件仍需交付 | 待填写 |

再解释：`code_interpreter_call.status`、`container_file_citation` 与可下载文件之间是什么关系？为什么生成文件不能只留在容器里？

## 本课检查

完成本课后，能解释：

- Code Interpreter 让模型在托管容器中编写并执行 Python，适合计算和文件变换；File Search、Web Search 与 Function Calling 解决不同问题。
- `tool_choice: "required"` 可要求使用已配置工具；文件通过上传后的 ID 提供给容器。
- `code_interpreter_call` 记录工具执行；消息中的文件引用指向容器产物，可通过容器文件内容接口下载。
- 容器有内存档位、空闲过期时间和网络策略；需要长期保存的结果应由应用下载并存储。

## 简化与边界

- 本课聚焦 Responses API 的自动容器、Python 执行、输入文件、输出文件和生命周期；不展开逐块上传、大文件分片、流式事件或 Chat Completions。
- Code Interpreter 支持的模型、文件类型、容器选项与计费可能变化；开发时以官方 Code Interpreter 指南和 API Reference 为准。
- 示例没有发送真实 API 请求；`file-...`、`cntr_example` 和 `cfile_example` 都是示意值。
