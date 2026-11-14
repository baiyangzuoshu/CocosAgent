# 第 0 课：源码包地图

**目标：** 从本地 `pyproject.toml` 识别 LangChain 家族的包名、版本、Python 要求和源码目录，建立后续源码阅读的边界。

## 本课增量

脚本只使用 Python 标准库 `tomllib` 读取仓库内的三个包清单：

~~~text
AI/langchain-master/libs/core/pyproject.toml          → langchain-core
AI/langchain-master/libs/langchain_v1/pyproject.toml  → langchain
AI/langchain-master/libs/langchain/pyproject.toml     → langchain-classic
~~~

它同时指出 `AI/langgraph-main/` 是另一份本地源码快照。本课不会导入或执行 LangChain 包。

## 源码与样例位置

- `AI/langchain-master/libs/README.md:9-21`：Monorepo 包目录说明。
- `AI/langchain-master/libs/core/pyproject.toml`：`langchain-core` 包名、版本与 Python 要求。
- `AI/langchain-master/libs/langchain_v1/pyproject.toml`：v1 `langchain` 包名、版本与 Python 要求。
- `AI/langchain-master/libs/langchain/pyproject.toml`：`langchain-classic` 包名、版本与 Python 要求。
- `src/main.py`：只读包清单并输出来源映射。

## 本课简化

课程只读取元数据，不导入包、不解析依赖锁文件，也不判断某个 provider 是否已安装。版本来自本地快照的 `pyproject.toml`，不代表网络上最新发布版本。

## 运行

在仓库根目录运行：

~~~sh
python3 learn_langchain/s00_source_map/src/main.py
~~~

输出应列出 `langchain-core 1.8.1`、`langchain 1.5.0`、`langchain-classic 1.0.8`，并显示各自本地源码目录及 `AI/langgraph-main/` 的独立边界。
