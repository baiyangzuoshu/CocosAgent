# 第 13 课：Provider 适配器与 Core 协议

**要回答的问题：** Provider 包如何把通用消息转换为服务商请求，再映射回统一消息？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/partners/openai/langchain_openai/chat_models/base.py：ChatOpenAI、request mapping`
- `AI/langchain-master/libs/core/langchain_core/language_models/chat_models.py：BaseChatModel`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
payload roles: ['system', 'user']
AI: simulated response
~~~

## 本课简化

只演示数据转换，不创建 HTTP 请求；真实实现还处理鉴权、错误、流式事件、工具调用和 usage。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s13_provider_adapter/src/main.py
~~~
