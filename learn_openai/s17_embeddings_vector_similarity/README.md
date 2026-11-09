# 第 17 课：Embedding 与向量相似度

**目标：** 能解释文本 Embedding 如何把文字转换为向量；能用向量相似度比较查询与候选文本，并理解它在搜索、聚类、分类和推荐中的作用与边界。

## 本课问题

程序怎样判断两段措辞不同的文字在意思上可能相关？Embedding 是搜索引擎、数据库，还是模型生成的答案？

## 前置知识

- [第 3 课](../s03_tokens_context_window/README.md)：Token 与模型输入长度。
- [第 5 课](../s05_model_selection/README.md)：按任务选择模型。
- [第 7 课](../s07_first_responses_request/README.md)：SDK 与 API 请求的基本结构。
- [第 15 课](../s15_audio_transcription_understanding/README.md)：文字转写后如何继续处理文本。

## 官方资料

- [Vector embeddings](https://developers.openai.com/api/docs/guides/embeddings)：查看 Embedding 的表示方式、用途、向量维度与相似度计算。
- [Create embeddings](https://developers.openai.com/api/reference/resources/embeddings/methods/create)：查询 `/v1/embeddings` 的输入、模型、`dimensions` 与返回对象字段。
- [text-embedding-3-small](https://developers.openai.com/api/docs/models/text-embedding-3-small) 和 [text-embedding-3-large](https://developers.openai.com/api/docs/models/text-embedding-3-large)：核对当前模型能力与模型状态。
- [Retrieval](https://developers.openai.com/api/docs/guides/retrieval)：预览语义搜索如何用向量从 Vector Store 找相关片段；完整工作流留到第 18 课。

## 1. Embedding 是把文本映射成向量

文本 Embedding 模型会把一段文字转换成一个由浮点数组成的向量。例如：

```text
“如何重置账号密码？” → [0.12, -0.04, 0.31, ...]
```

这个向量不是文字内容的压缩存档，也不是可以逐维阅读的词典。它是模型学到的一种数值表示，适合和其他向量比较相关程度。措辞不同但语义相近的文本，通常会有较高相似度。

Embedding API 负责产生向量。它本身不会搜索你的文件、挑出答案或撰写回答；要做检索，还需要保存候选向量并计算或查询最近邻。[Vector embeddings](https://developers.openai.com/api/docs/guides/embeddings)

## 2. 生成向量并比较候选文字

可以把多条文字作为 `input` 数组一次发送。下面用一个查询和两条候选内容做小规模演示：

```ts
import OpenAI from "openai";

const client = new OpenAI();

const result = await client.embeddings.create({
  model: "text-embedding-3-small",
  input: [
    "如何重置账号密码？",
    "忘记密码后怎样重新设置？",
    "如何修改收货地址？",
  ],
});

const vectors = result.data
  .sort((a, b) => a.index - b.index)
  .map((item) => item.embedding);

const [query, passwordHelp, addressHelp] = vectors;
if (!query || !passwordHelp || !addressHelp) {
  throw new Error("没有收到全部 Embedding 向量");
}

function dotProduct(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("向量维度必须相同");
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i]! * b[i]!;
  }
  return sum;
}

console.log("密码帮助相似度：", dotProduct(query, passwordHelp));
console.log("地址帮助相似度：", dotProduct(query, addressHelp));
```

官方 Embedding 向量已归一化为长度 1，因此点积可以直接用作余弦相似度。这个示例预期密码帮助文本与查询更相关；实际分数要通过 API 返回结果检查，不能把示例中的预期当作固定阈值。[Vector embeddings：FAQ](https://developers.openai.com/api/docs/guides/embeddings)

API 的返回对象包含 `data`、使用的模型和 Token 用量；每个 `data` 项包含 `embedding` 与对应输入的 `index`。保存批量结果时，用 `index` 对齐输入与向量，不要依赖未核验的数组顺序。[Create embeddings](https://developers.openai.com/api/reference/resources/embeddings/methods/create)

## 3. 相似度分数怎样解读

| 比较量 | 含义 | 如何读 |
| --- | --- | --- |
| 余弦相似度 | 两个向量方向有多接近 | 分数越高，方向越相近 |
| 点积 | 向量各维乘积之和 | Embedding 向量归一化后，可用来得到余弦相似度 |
| 欧氏距离 | 两个向量之间的直线距离 | 距离越小，向量越接近 |

OpenAI Embedding FAQ 指出，余弦相似度和欧氏距离通常给出相同的排序，因为向量长度已归一化。检索时重点是候选项之间的相对顺序，不要把某个相似度分数误解成模型回答正确的概率。[Vector embeddings：FAQ](https://developers.openai.com/api/docs/guides/embeddings)

## 4. Embedding 常见用途

| 用途 | 做法 | 例子 |
| --- | --- | --- |
| 语义搜索 | 比较查询向量与文档或片段向量，返回相似度较高的内容 | 用“怎样找回账号”找到标题为“密码重置”的帮助页 |
| 聚类 | 比较一批文本的向量，把相似文本分组 | 将客服工单归为登录、支付、物流等主题 |
| 分类 | 把文本与类别名称或描述的向量比较 | 将反馈分到“功能请求”“错误报告”等类别 |
| 推荐 | 比较用户、商品或内容的向量 | 推荐与用户当前兴趣相近的商品说明 |

Embedding API 只给出向量；应用要负责存储数据、选择相似度计算或向量索引，再根据用途处理匹配结果。[Vector embeddings](https://developers.openai.com/api/docs/guides/embeddings)

## 5. 模型和维度要保持一致

当前示例使用 `text-embedding-3-small`。官方指南列出的默认维度为 1536；`text-embedding-3-large` 默认维度为 3072。`text-embedding-3` 系列支持用 `dimensions` 请求较短的向量。选定模型和维度后，生成查询向量与已保存的候选向量时应保持一致；切换模型或维度时，要按新配置重新生成索引向量。[Vector embeddings](https://developers.openai.com/api/docs/guides/embeddings)、[Create embeddings](https://developers.openai.com/api/reference/resources/embeddings/methods/create)

每个输入要符合所选模型的 Token 限制。当前 Embeddings API Reference 对这些模型列出每条输入最多 8192 Token，且单个请求内所有输入的 Token 总数也有限制；大文档需要先按应用的语义边界拆分成多个片段，再分别生成向量。如何组织文件、片段、向量库和检索过程会在第 18 课展开。[Create embeddings](https://developers.openai.com/api/reference/resources/embeddings/methods/create)

## 观察练习

判断下列场景是否适合单靠语义向量相似度，并说明还需要什么：

| 场景 | 你的判断 |
| --- | --- |
| 用户问“忘了密码怎么办”，从帮助文章中找到密码重置指南 | 待填写 |
| 精确查找订单号 `AB-10572` | 待填写 |
| 把 5000 条意见按主题归类 | 待填写 |
| 判断某个生成式回答是否事实正确 | 待填写 |

## 本课检查

完成本课后，能解释：

- Embedding 是文本对应的浮点向量表示，距离或方向可以用来估计文本相关程度。
- `/v1/embeddings` 根据输入文本返回向量；返回的向量不是生成的答案，也不是已经建好的搜索索引。
- 对归一化的 Embedding 向量，点积可作为余弦相似度；相似度排名不是正确率或置信概率。
- 向量相似度可用于语义搜索、聚类、分类和推荐。
- 查询与候选向量必须维度一致；选定模型与维度后要在索引和查询侧使用相同配置。
- 精确 ID、数字、时间等任务可能需要关键词或结构化过滤；单靠语义相似度不一定够。

## 简化与边界

- 代码对少量向量在内存中计算点积，适合解释原理；大规模搜索需索引或向量数据库，后续再学 Vector Store 和 File Search。
- 本课不展开向量数据库选择、过滤、混合检索、重排序或评估方法。
- 示例没有实际调用 Embeddings API；模型名称、维度和输入限制以当前模型页与 API Reference 为准。
