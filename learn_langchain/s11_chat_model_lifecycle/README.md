# 第 11 课：BaseChatModel 调用生命周期

**要回答的问题：** 统一聊天模型接口如何把消息输入转换为 AIMessage 输出？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/core/langchain_core/language_models/chat_models.py：BaseChatModel.invoke、generate、stream`
- `AI/langchain-master/libs/core/langchain_core/outputs/chat_result.py：ChatResult`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
events: ['start', 'generate', 'end']
AI: Echo: hello
~~~

## 本课简化

跳过 token usage、重试、缓存、批处理和 provider 响应规范化；假模型不发网络请求。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s11_chat_model_lifecycle/src/main.py
~~~
