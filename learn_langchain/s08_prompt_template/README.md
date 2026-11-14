# 第 8 课：PromptTemplate 与 PromptValue

**要回答的问题：** 模板变量怎样从输入字典变成模型可用的提示内容？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/core/langchain_core/prompts/base.py：BasePromptTemplate`
- `AI/langchain-master/libs/core/langchain_core/prompts/prompt.py：PromptTemplate`
- `AI/langchain-master/libs/core/langchain_core/prompt_values.py：StringPromptValue`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
Tell a short story about a comet.
~~~

## 本课简化

仅支持 str.format 字符串模板；源码还处理部分变量、模板格式、安全校验和消息型 PromptValue。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s08_prompt_template/src/main.py
~~~
