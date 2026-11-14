# 第 10 课：消息类型与多模态内容块

**要回答的问题：** 怎样区分对话角色、工具调用和多模态消息内容？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/core/langchain_core/messages/base.py：BaseMessage`
- `AI/langchain-master/libs/core/langchain_core/messages/ai.py：AIMessage、tool_calls`
- `AI/langchain-master/libs/core/langchain_core/messages/tool.py：ToolMessage`
- `AI/langchain-master/libs/core/langchain_core/messages/content.py：content blocks`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
human: Describe this image.
image block: https://example.test/cat.png
AI tool calls: ['get_weather']
~~~

## 本课简化

图片以 URL 文本表示；源码还支持 provider-specific blocks、音频、视频、拒答和签名数据。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s10_message_content_blocks/src/main.py
~~~
