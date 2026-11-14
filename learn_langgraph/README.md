# learn_langgraph

基于仓库中的 LangGraph Python 1.2.22 源码快照逐课学习图运行时。课程主线从构建图、编译图开始，继续追踪 Pregel 执行、流式输出、检查点和中断恢复。

## 学习方式

每课围绕一个问题，先读对应版本的源码，再运行一份精简的 Python 教学实现，观察状态与执行顺序。每课目录独立运行，后续课程逐步增加一个运行时机制。

教学实现用于解释源码中的职责边界，不导入 LangGraph 包，也不追求 API 兼容。节点使用确定性 Python 函数，不需要模型 API Key。

## 版本与环境

- LangGraph 源码快照：[AI/langgraph-main](../AI/langgraph-main/README.md)。
- Python 包版本：[libs/langgraph/pyproject.toml](../AI/langgraph-main/libs/langgraph/pyproject.toml)，版本 1.2.22，要求 Python 3.10 或更高。
- 第 1 课仅使用 Python 标准库；后续课程的额外依赖会在对应课程单独注明。

## 课程入口

- [课程大纲：30 课](课程大纲.md)
- [第 1 课：从 StateGraph 到可执行图](s01_minimal_stategraph/README.md)

当前完成：第 1 课。
