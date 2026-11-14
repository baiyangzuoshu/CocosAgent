# 附篇 A1：LLMChain 与 SequentialChain

**要回答的问题：** 旧 Chain 怎样把 Prompt、模型调用和多步输入输出封装在一起？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/langchain/langchain_classic/chains/base.py：Chain`
- `AI/langchain-master/libs/langchain/langchain_classic/chains/llm.py：LLMChain`
- `AI/langchain-master/libs/langchain/langchain_classic/chains/sequential.py：SequentialChain`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
result: HELLO!
~~~

## 本课简化

用本地函数模拟 LLM；这里只比较旧 Chain 封装与 Runnable 组合，不将旧 API 作为新项目主线。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/a1_classic_chains/src/main.py
~~~
