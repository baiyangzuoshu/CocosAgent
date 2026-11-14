# 第 18 课：Update 阶段怎样提交节点写入

**目标：** 观察同一步任务读取旧状态，并在任务完成后统一提交写入。

## 本课问题

并行节点为什么不会立即看到同一步中其他节点的更新？

## 本课增量

两个任务都从同一个旧状态计算写入，随后由 Update 阶段统一合并。

## 源码对照

- [_algo.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/_algo.py)：apply_writes 聚合任务写入并更新 channels。
- [_loop.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/_loop.py)：PregelLoop 在 step 边界推进写入与 checkpoint。

## 代码结构

~~~text
s18_update_barrier/
├── README.md
└── src/
    └── main.py
~~~

## 运行

在本课目录执行：

~~~sh
python3 src/main.py
~~~

预期输出：

~~~text
seen: {'left': 0, 'right': 0}
writes: {'left': {'left': 1}, 'right': {'right': 10}}
committed: {'count': 0, 'left': 1, 'right': 10}
~~~

## 观察结果

- 两个任务都看到 step 开始时的 count=0。
- 新值在 Update 阶段统一进入下一状态。

## 简化与边界

- 本课用串行计算复现同步屏障的可见性规则，不表示节点串行执行。
- 同键多写入需要 channel/reducer 处理；本例刻意写入不同键。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
