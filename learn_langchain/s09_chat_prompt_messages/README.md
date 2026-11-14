# 第 9 课：ChatPromptTemplate 与消息拼装

**要回答的问题：** 多条角色消息怎样通过模板变量组成一次聊天输入？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/core/langchain_core/prompts/chat.py：ChatPromptTemplate、format_messages`
- `AI/langchain-master/libs/core/langchain_core/prompts/message.py：BaseMessagePromptTemplate`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
system: Answer briefly.
human: What is 2 + 2?
~~~

## 本课简化

只支持 system/human 两种固定模板；源码还支持占位符、示例选择和多种消息表示。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s09_chat_prompt_messages/src/main.py
~~~
