# 第 26 课：文件读取、写入、编辑与 Diff

**目标：** 对照 `Read`、`Write`、`Edit` 三条文件工具路径，说明输入校验、读后修改保护、磁盘写入和 Diff 展示分别由哪些模块负责。

## 本课要回答的问题

1. 文件工具共用什么执行顺序，工具级 `validateInput()` 与权限检查各自负责什么？
2. `Read` 如何处理文本、图片、PDF 和 Notebook，并把内容交给模型与终端？
3. `Write` 的全文替换与 `Edit` 的字符串替换怎样避免基于过期内容写入？
4. `structuredPatch` 怎样生成并展示？它是否就是实际写入操作？

## 共用执行框架与三条数据路径

~~~mermaid
flowchart TD
  A[模型提交文件工具输入] --> B[Zod Schema]
  B --> C[工具 validateInput]
  C --> D[PreToolUse 与文件权限决策]
  D -->|allow| E[工具 call]
  E --> F{Read / Write / Edit}
  F -->|Read| G[按路径类型读取并限制输出]
  G --> H[文本、图像、PDF、Notebook 或未变化结果]
  F -->|Write| I[全文内容写入]
  F -->|Edit| J[按 old_string 定位后替换]
  I --> K[更新 readFileState 并生成结构化 patch]
  J --> K
  H --> L[模型收到内容或附件；终端显示读取摘要]
  K --> M[模型收到成功摘要；终端显示代码或 Diff]
~~~

第 23 课梳理了通用工具生命周期：Schema 解析后调用工具自己的 `validateInput()`，再经过 PreToolUse 与权限流程，获准后才进入 `call()`。文件工具把不同检查拆开：输入校验可拒绝无效操作；`checkPermissions()` 则委托文件系统权限帮助函数，按路径和读取 / 编辑规则作出权限决定。

有一个顺序细节：`FileEditTool.validateInput()` 为确认目标字符串、重复次数和文件状态，会在通用权限决定前读取目标文件内容；它会先检查拒绝规则，UNC 路径则跳过本地文件操作。这个校验阶段不等于最终权限放行，也不应与 `call()` 的实际修改混为一谈。

## Read：多种文件类型，共用路径权限与输出上限

`Read` 的输入包含路径、行偏移、行数上限和 PDF 页码范围。`validateInput()` 会检查 PDF 页码格式与单次页数上限、路径拒绝规则、普通二进制文件扩展名和可能阻塞的设备文件；UNC 路径会延后文件系统访问，让权限流程处理。

进入 `call()` 后，路径后缀决定读取分支：文本走 `readFileInRange()`，并校验输出 token 上限；图片读入后按 token 预算缩放或压缩；PDF 可作为文档附件发送，也可抽取选定页为图片；Notebook 则转换成单元格结构。文本结果会附带起始行和行号格式，模型侧收到文件内容或多模态附件。

文本与 Notebook 读取会把内容、时间戳和范围记录进 `readFileState`。对同一路径、同一范围，如果记录仍是完整视图且文件修改时间未变，`Read` 可返回 `file_unchanged` 占位，避免重复发送整份内容。终端 UI 对应显示“读取了多少行 / 页 / 单元格”或“自上次读取后未变化”；它不直接复现模型侧收到的正文。

## Write 与 Edit：操作粒度不同，读状态相互衔接

`Write` 输入是一条绝对路径和完整内容；覆盖已有文件前，校验要求路径有完整读取记录，并检查读取后是否发生修改。新文件不需要已有读取记录。进入 `call()` 后，它再次检查当前文件状态，再以完整内容替换文件；持久化后刷新 `readFileState`，使后续操作使用新的时间戳和内容。

`Edit` 输入是 `old_string`、`new_string` 与可选的 `replace_all`。校验会拒绝相同的新旧字符串、找不到的旧文本、默认模式下的多处匹配、超大文件和 `.ipynb`；Notebook 需走专用工具。它要求目标已经完整读取，并检查读取后是否被用户或其他程序修改。`findActualString()` 先找精确文本，再尝试弯引号归一化；写入前还会重新检查文件状态。实际替换保留文件编码与换行风格，并将新内容和时间戳写回 `readFileState`。

`Write` 和 `Edit` 都有独立的 `checkPermissions()`，调用 `checkWritePermissionForTool()`；这与输入校验中的“是否读过、内容是否仍匹配、路径是否可处理”是不同判断。`Edit` 还会通过设置文件校验器检查 Claude 设置文件的修改结果。

## Diff：结果展示数据与磁盘副作用分开

写入与编辑的 `call()` 才负责持久化。`FileEditTool` 先由 `getPatchForEdit()` 生成新内容和 patch，再调用 `writeTextContent()`；`FileWriteTool` 先写完整内容，再根据旧内容生成更新 patch。`getPatchForEdit()` 本身只计算结果，不直接写磁盘。`structuredPatch` 面向展示，生成时把行首 Tab 转成空格；它不应被当作文件字节级快照。远端模式中，另有受环境变量和功能开关控制的可选 `gitDiff` 字段。

成功结果有两种呈现：`mapToolResultToToolResultBlockParam()` 给模型返回简短成功文字；终端 UI 则使用 `structuredPatch` 展示增删行和 Diff。新建文件显示内容，覆盖或字符串编辑显示差异。`StructuredDiffList` 按 hunk 列表渲染并用省略号分隔；`StructuredDiff` 尝试彩色语法 Diff，禁用或不可用时回退到普通结构化渲染。

因此，工具结果里的 Diff 是写入后的展示数据，不是写入前审批，也不承担磁盘写入。读取结果则相反：正文或附件进入模型的 tool_result，终端通常只展示读取摘要。

## 静态观察

在仓库根目录执行以下命令，只读取源码：

~~~sh
nl -ba AI/claude-code-analysis-main/src/services/tools/toolExecution.ts | sed -n '614,730p;795,930p;995,1035p;1206,1222p'
nl -ba AI/claude-code-analysis-main/src/utils/permissions/filesystem.ts | sed -n '1030,1135p;1205,1275p'
nl -ba AI/claude-code-analysis-main/src/tools/FileReadTool/FileReadTool.ts | sed -n '227,331p;373,405p;418,495p;496,573p;652,718p;804,862p;865,876p;1019,1085p;1097,1145p'
nl -ba AI/claude-code-analysis-main/src/tools/FileReadTool/limits.ts | sed -n '18,91p'
nl -ba AI/claude-code-analysis-main/src/tools/FileWriteTool/FileWriteTool.ts | sed -n '56,89p;135,221p;223,337p;344,433p'
nl -ba AI/claude-code-analysis-main/src/tools/FileEditTool/FileEditTool.ts | sed -n '86,136p;137,361p;387,495p;516,595p'
nl -ba AI/claude-code-analysis-main/src/tools/FileEditTool/utils.ts | sed -n '73,93p;234,293p'
nl -ba AI/claude-code-analysis-main/src/utils/diff.ts | sed -n '128,177p'
nl -ba AI/claude-code-analysis-main/src/tools/FileReadTool/UI.tsx | sed -n '77,143p'
nl -ba AI/claude-code-analysis-main/src/tools/FileWriteTool/UI.tsx | sed -n '362,404p'
nl -ba AI/claude-code-analysis-main/src/tools/FileEditTool/UI.tsx | sed -n '77,91p'
nl -ba AI/claude-code-analysis-main/src/components/StructuredDiffList.tsx | sed -n '1,29p'
nl -ba AI/claude-code-analysis-main/src/components/StructuredDiff.tsx | sed -n '11,18p;50,65p;95,140p'
~~~

## 观察结果

- 三种工具都先走 Schema 与工具级输入校验，再进入 Hook 和权限决策；校验、权限和实际 `call()` 各自承担不同职责。
- `Read` 同时支持文本、图片、PDF 和 Notebook；模型侧内容与终端里的读取摘要并不是同一份呈现。
- 覆盖和编辑会利用 `readFileState` 与修改时间防止直接基于旧内容落盘；`Edit` 还验证替换文本是否存在且位置明确。
- `structuredPatch` 由写入 / 编辑结果驱动终端展示；生成 patch 的 helper 与实际文件写入是分开的。

## 范围与限制

- 本课聚焦三种文件工具的主要路径与 Diff 呈现，不逐项展开路径权限规则、PDF 提取器、图像处理或 Notebook 单元格协议。
- 结论来自当前源码快照的静态阅读；未运行 CLI、未验证终端渲染或各平台文件系统行为。
