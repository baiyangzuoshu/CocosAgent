# 第 16 课：输出解析与结构化结果

**要回答的问题：** 模型生成的 JSON 字符串怎样变成经过校验的数据对象？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/core/langchain_core/output_parsers/base.py：BaseOutputParser`
- `AI/langchain-master/libs/core/langchain_core/output_parsers/json.py：JsonOutputParser`
- `AI/langchain-master/libs/core/langchain_core/output_parsers/pydantic.py：PydanticOutputParser`
- `AI/langchain-master/libs/langchain_v1/langchain/agents/structured_output.py：response formats`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
Ticket(category='billing', urgent=True)
~~~

## 本课简化

使用标准库 dataclass 和 json；源码支持 Pydantic、provider-native output、tool strategy 和重试。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s16_structured_output/src/main.py
~~~
