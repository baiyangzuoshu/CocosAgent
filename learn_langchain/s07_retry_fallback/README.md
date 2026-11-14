# 第 7 课：Retry、Fallback 与失败传播

**要回答的问题：** 步骤失败时，怎样重试、切换备用步骤或把最终错误交给调用方？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/core/langchain_core/runnables/retry.py：RunnableRetry`
- `AI/langchain-master/libs/core/langchain_core/runnables/fallbacks.py：RunnableWithFallbacks`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
retry result: ready (attempts=3)
fallback result: backup
~~~

## 本课简化

未加入退避时间、异常筛选或异步重试；真实应用要控制哪些错误可重试。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s07_retry_fallback/src/main.py
~~~
