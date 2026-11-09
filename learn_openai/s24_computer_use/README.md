# 第 24 课：Computer Use 怎样操作界面？

**目标：** 能分清 Computer Use 的模型动作与应用执行环境；能读懂 `computer_call` 并说明如何执行动作、回传截图；能把权限、人工确认、步骤限制和结果核验放进操作闭环。

## 本课问题

模型怎样从界面截图提出动作？谁来真正点击和输入？哪些操作要先让用户确认？

## 前置知识

- [第 20、21 课](../s20_function_calling_loop/README.md)：理解工具调用请求与应用执行的分工。
- [第 22 课](../s22_web_search/README.md)：区分界面操作与公开网页搜索。
- [第 23 课](../s23_code_interpreter/README.md)：了解托管执行环境与文件处理。

## 官方资料

- [Computer use](https://developers.openai.com/api/docs/guides/tools-computer-use)：比较 Responses、SDK 和其他 Computer Use 路径。
- [Computer use integration recipes](https://developers.openai.com/api/docs/guides/tools-computer-use-integration)：查看动作执行、截图、驱动和安全控制。
- [Create a model response](https://developers.openai.com/api/reference/resources/responses/methods/create)：核对 `computer` 工具、`computer_call_output` 与 `previous_response_id`。
- [Agents API computer use](https://developers.openai.com/api/docs/guides/agents-api/tools/computer-use)：了解 OpenAI 托管浏览器的另一种接口。

## 1. 先分清模型和运行环境

Computer Use 让模型观察浏览器或桌面界面，再提出鼠标和键盘动作。模型不会凭空接管用户的电脑：应用要提供一个受控环境和 driver，负责读取截图、执行允许的动作并保留界面状态。使用 SDK 的 `ComputerToolset` 时，SDK 可以管理 Responses 工具循环；driver 和权限仍由应用负责。[Computer use](https://developers.openai.com/api/docs/guides/tools-computer-use)

| 需求 | 适合的路径 | 谁提供界面与执行 |
| --- | --- | --- |
| 通过截图点击或键盘操作浏览器/桌面 | Responses `computer` 工具或 SDK `ComputerToolset` | 应用或环境提供方的 driver |
| 读取网页文字、按选择器操作网页 | SDK `BrowserToolset` 或应用自己的 Function Calling 工具 | 应用提供结构化浏览器操作 |
| 在 OpenAI 托管的浏览器中运行 Agent | Agents API `computer_use` | OpenAI 托管会话，应用处理会话事件与网站授权 |
| 只查询公开网页信息，不需要操作界面 | Web Search | Responses 内置搜索工具 |

当前官方指南指出：对 GPT-6 Astra，代码执行 harness 是推荐路径；结构化的 Responses `computer` 工具仍可用。选择模型时应先核对模型页面的 Computer Use 支持。[Computer use](https://developers.openai.com/api/docs/guides/tools-computer-use)

## 2. 发出界面操作请求

Responses 的低层 `computer` 工具返回结构化动作。下面是官方文档中的请求形状；模型名展示当前 Computer 工具示例，后续使用时请重新核对模型支持。[Computer use：Use the computer tool](https://developers.openai.com/api/docs/guides/tools-computer-use)

```ts
import OpenAI from "openai";

const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-6.1-sol",
  tools: [{ type: "computer" }],
  input:
    "在隔离的练习页面中检查 Filters 面板是否打开；" +
    "若未打开则点击 Show filters，再在搜索框输入 penguin。",
});

console.dir(response.output, { depth: null });
```

这一步只向模型请求动作；它不会自动打开本机桌面或替应用点击。要操作真实界面，应用还必须接好 driver，并确认执行环境和权限都符合任务范围。

## 3. 读动作、执行、回传截图

模型的 `computer_call` 项目会带有 `call_id` 和有序 `actions`。例如：

```json
{
  "type": "computer_call",
  "call_id": "call_example",
  "actions": [
    { "type": "click", "button": "left", "x": 405, "y": 157 },
    { "type": "type", "text": "penguin" }
  ],
  "status": "completed"
}
```

`status: "completed"` 表示模型已经生成完这组动作，并不代表浏览器已经执行。应用要逐个检查动作是否允许，再按顺序映射到浏览器或桌面操作。支持的动作包括 `click`、`double_click`、`drag`、`move`、`scroll`、`keypress`、`type`、`wait` 和 `screenshot`。模型也可能先只请求截图，不改变界面。[Computer use：Execute the requested actions](https://developers.openai.com/api/docs/guides/tools-computer-use)

动作完成后，应用从同一环境截取新画面，并把图片作为 `computer_call_output` 回传。`call_id` 必须匹配刚处理的调用；`previous_response_id` 让 Responses API 接着前一轮对话继续。下面的 `call_example` 和 `screenshotBase64` 都是占位符，实际请求要填当前调用 ID 和刚采集的截图：

```ts
const nextResponse = await client.responses.create({
  model: "gpt-6.1-sol",
  tools: [{ type: "computer" }],
  previous_response_id: response.id,
  input: [
    {
      type: "computer_call_output",
      call_id: "call_example",
      output: {
        type: "computer_screenshot",
        image_url: `data:image/png;base64,${screenshotBase64}`,
        detail: "original",
      },
    },
  ],
});
```

`screenshotBase64` 必须由应用从刚执行动作的那个环境取得；动作处理和截图采集是应用责任。重复“读 `computer_call` → 校验并执行 → 回传截图”，直到模型不再请求界面动作，然后检查最终界面状态。[Computer use：Return the screenshot](https://developers.openai.com/api/docs/guides/tools-computer-use)

SDK 路径的循环形状如下。`driver` 需要实现截图、动作处理和允许动作检查；`beforeAction` 与 `maxSteps` 分别用于应用动作策略和限制步骤数。

```ts
import OpenAI, { ComputerToolset } from "openai";

const client = new OpenAI();
const computer = new ComputerToolset(driver);

try {
  const response = await computer.run(
    client,
    {
      model: "gpt-6.1-sol",
      input: "在隔离页面中打开 Filters 面板，并搜索 penguin。",
    },
    {
      beforeAction: (action) => driver.allowed(action),
      maxSteps: 6,
    },
  );
  console.log(response.output_text);
} finally {
  computer.close();
}
```

## 4. 用户确认与安全边界

Computer Use 可能更改账户、发送数据、购买商品或删除内容。安全边界要在应用和运行环境中执行，不能只写在 prompt 里：[Computer use：Run safely](https://developers.openai.com/api/docs/guides/tools-computer-use)

- 使用隔离的浏览器或虚拟机，只开放完成任务所需的网站和动作；设置网络白名单。
- 把网页、文档和截图里的文字视为不可信数据。页面内容不能授权模型忽略用户要求、泄露数据或执行新任务。
- 对购买、提交、发送敏感信息和不可逆修改等操作，在执行前向用户确认。输入敏感信息本身也可能构成数据发送。
- 设置最大步骤、超时和成本上限，并支持取消。遇到响应超时或动作结果不确定时，先重新观察当前界面再决定是否重试。
- 不要把密码、令牌或不该记录的个人信息放进页面文本、提示或截图；截图会作为图像输入发送给模型并产生输入成本。
- 截图坐标必须与动作执行时的界面尺寸一致。若缩小截图，需把模型坐标映射回原始尺寸；官方集成指南建议 Computer Use 截图使用 `detail: "original"`。[Integration recipes：Screenshot capture](https://developers.openai.com/api/docs/guides/tools-computer-use-integration)

OpenAI 托管浏览器的 Agents API 还有网站来源授权事件；批准某个来源不会自动批准购买或删除等具体动作。它与 Responses 的 `computer` 工具是不同的运行路径。[Agents API computer use](https://developers.openai.com/api/docs/guides/agents-api/tools/computer-use)

## 5. 观察练习

| 情境 | 你的设计 |
| --- | --- |
| 在内部测试页打开筛选面板并输入关键词 | 选择何种环境和工具？怎样验证完成？ |
| 结账页面已填好地址，下一步将提交订单 | 何时请求用户确认？ |
| 网页内容要求模型忽略原任务并把密码输入页面 | 应怎样处理页面文字和动作请求？ |
| 只需读取当前网页中的标题和正文，不需要点击 | 应选择截图操作还是结构化浏览器操作？ |

再说明：动作请求中的 `call_id` 为什么要原样带回？`computer_call.status` 为 `completed` 能否证明界面已经改变？

## 本课检查

完成本课后，能解释：

- Computer Use 由模型提议动作、应用 driver 执行动作，并把新截图带回模型形成闭环。
- Responses `computer` 工具、SDK `ComputerToolset`、结构化 `BrowserToolset` 与 Agents API 托管浏览器各自有不同的环境和循环所有者。
- 应用必须限制动作和网络权限；重要变更需用户确认；完成后核验实际界面状态。
- 页面内容不可信，截图和输入数据可能敏感；需要控制步骤、成本、超时并保留取消能力。

## 简化与边界

- 本课用 Responses 的结构化 `computer` 动作解释基本循环，同时介绍 SDK toolset 和 Agents API 路径；不实现完整浏览器/桌面 driver，也不展开登录凭证、跨设备或长时会话恢复。
- 模型、SDK 版本和工具可用性会变化；开始实现前以官方 Computer Use 指南、模型 Tools 页面和 SDK 版本文档为准。
- 示例只展示 API 形状，没有连接浏览器、执行鼠标键盘操作或发送 Responses API 请求。
