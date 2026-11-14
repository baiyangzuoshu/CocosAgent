# 第 19 课：文本切分与 Chunk Metadata

**要回答的问题：** 长文怎样切成有限大小的片段，同时保留来源元数据和重叠上下文？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/text-splitters/langchain_text_splitters/character.py：CharacterTextSplitter`
- `AI/langchain-master/libs/text-splitters/langchain_text_splitters/base.py：TextSplitter.split_documents、create_documents`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
chunk 1: abcdef source=notes.txt
chunk 2: efghij source=notes.txt
~~~

## 本课简化

使用定长字符窗口；真实 splitter 可按分隔符、语言语法或 token 长度切分，并维护字符位置。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s19_text_splitting/src/main.py
~~~
