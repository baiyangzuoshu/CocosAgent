# 第 12 课：init_chat_model 与 Provider 解析

**要回答的问题：** 统一模型标识怎样选择并构造一个 provider 实现？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/langchain_v1/langchain/chat_models/base.py：init_chat_model、provider resolution`
- `AI/langchain-master/libs/langchain_v1/langchain/chat_models/__init__.py：public exports`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
provider: fake
result: Hello from fake
~~~

## 本课简化

只注册一个本地 fake provider；源码还会延迟导入 provider 包并转发模型参数。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s12_model_provider_factory/src/main.py
~~~
