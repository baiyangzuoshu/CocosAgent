# 第 17 课：Callback 生命周期与 Tracing

**要回答的问题：** 父链和子步骤怎样把开始、结束事件组织成一条运行轨迹？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/core/langchain_core/callbacks/base.py：BaseCallbackHandler`
- `AI/langchain-master/libs/core/langchain_core/callbacks/manager.py：CallbackManager、run managers`
- `AI/langchain-master/libs/core/langchain_core/runnables/base.py：callbacks/config propagation`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
chain start
model start parent=chain
model end
chain end
~~~

## 本课简化

只记录四种同步事件；源码还支持异步回调、错误、token 流、多个 handlers 和 LangSmith tracer。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s17_callbacks_tracing/src/main.py
~~~
