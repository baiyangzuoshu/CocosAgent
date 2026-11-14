# 第 4 课：RunnableConfig 与配置传递

**要回答的问题：** 调用标签和运行名怎样沿着组合步骤传下去？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/core/langchain_core/runnables/config.py：RunnableConfig、ensure_config`
- `AI/langchain-master/libs/core/langchain_core/runnables/base.py：config merge 与 run context`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
result: CORE
child tags: ['course', 's04']
~~~

## 本课简化

这里只传递 tags；源码配置还包含 callbacks、metadata、run_name、max_concurrency 等字段。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s04_config_propagation/src/main.py
~~~
