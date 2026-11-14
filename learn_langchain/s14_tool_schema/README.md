# 第 14 课：Tool 定义、参数 Schema 与调用

**要回答的问题：** Python 函数怎样变成带名称、说明和参数校验的工具？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/core/langchain_core/tools/base.py：BaseTool、args_schema、invoke`
- `AI/langchain-master/libs/core/langchain_core/tools/convert.py：tool、StructuredTool.from_function`
- `AI/langchain-master/libs/core/langchain_core/tools/structured.py：StructuredTool`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
tool: weather
result: sunny in Tokyo
~~~

## 本课简化

仅校验必需参数名；真实 Tool 会构造 Pydantic schema、处理注入参数、异步调用和错误。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s14_tool_schema/src/main.py
~~~
