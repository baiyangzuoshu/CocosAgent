# 第 3 课：并行分支与条件路由

**要回答的问题：** 同一输入怎样同时流向多个步骤，或按条件选择一个步骤？

## 本课增量

本课示例实现上述执行路径，保留当前主题的主要数据形状和调用边界。

## 源码与关键位置

- `AI/langchain-master/libs/core/langchain_core/runnables/base.py：RunnableParallel`
- `AI/langchain-master/libs/core/langchain_core/runnables/branch.py：RunnableBranch`

本目录的 `src/main.py` 是独立精简实现，不导入 LangChain 源码包。

## 观察结果

~~~text
parallel: {'upper': 'CORE', 'length': 4}
route: short
~~~

## 本课简化

并行步骤按顺序执行，条件路由只取第一个匹配项；源码还支持并发、配置传递和流式输出。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s03_parallel_routing/src/main.py
~~~
