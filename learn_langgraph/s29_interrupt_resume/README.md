# 第 29 课：interrupt 怎样暂停运行，恢复时又从哪里继续

**目标：** 观察图保存暂停状态与后续恢复输入的基本边界。

## 本课问题

人工审批暂停后，恢复输入如何交回到暂停节点？

## 本课增量

节点产生 InterruptRequest 后保存当前状态；resume 提供审批值，再从等待点继续后续节点。

## 源码对照

- [types.py](../../AI/langgraph-main/libs/langgraph/langgraph/types.py)：Interrupt 与 Command 的类型承载暂停和恢复信号。
- [_loop.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/_loop.py)：PregelLoop 管理中断检查、checkpoint 与恢复运行。
- [main.py](../../AI/langgraph-main/libs/langgraph/langgraph/pregel/main.py)：invoke 与 stream 接受恢复输入并继续图执行。

## 代码结构

~~~text
s29_interrupt_resume/
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
paused: {'state': {'item': 'refund-42'}, 'interrupt': 'approve refund-42?'}
resumed: {'item': 'refund-42', 'approved': True, 'status': 'continue'}
pre-interrupt executions: 2
~~~

## 观察结果

- 暂停需要保留状态和等待信息；使用 `Command(resume=...)` 恢复同一条持久化线程。
- 恢复时会从中断所在节点的开头重跑；示例中的中断前操作执行了两次。

## 简化与边界

- 教学模型把 interrupt 当作返回对象；真实 interrupt() 会通过运行时 scratchpad 与 PregelLoop 协作。
- 省略了 Checkpointer、thread_id 和 resume 顺序规则；真实工作流需要让中断前的副作用可安全重试，或把副作用放到 interrupt 之后。

本课程序使用 Python 标准库，是用于解释源码职责的教学实现，不导入或替代 LangGraph。
