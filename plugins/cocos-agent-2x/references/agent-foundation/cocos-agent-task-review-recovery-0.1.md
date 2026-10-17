# CocosAgent 任务审阅、权限与 Checkpoint 合同 0.1

状态：恢复与逐工具审批已有实现；回执级任务差异汇总已接入源码；任务权限范围和 checkpoint 为设计合同，未实现；Creator 原生面板端到端验收待完成。适用 Creator 2.4.15。

## 目标

把一个 run 内已记录的代码、场景/Prefab、资源变更和 operation 状态汇总为可审阅结果，并让取消、中断、重启或恢复冲突能明确停止在安全状态。任务审阅不是全项目 Git diff；checkpoint 不替代 Creator operation ledger。

## 任务审阅合同

- 审阅按本机 runId 关联，来源为同一 run 的 MCP 工具回执。将脚本写入归为代码变更、场景节点/Prefab/组合操作归为场景变更、其余归为其他写入；保存命令、operationId、回执状态、已返回的精确 expectedDiff、脚本路径/UUID 和前后 SHA（若工具返回）。
- 区分 `success`、`needs-review`、失败/无回执、`verification-pending` 等状态；不得把 plan proposal 或 expectedDiff 单独表述成已落盘差异。UI 标示汇总范围为“工具回执”，并说明它不证明回执未覆盖的工程文件或编辑器状态没有变化。
- 完整审阅还需要真实磁盘/Creator 读回、导入/编译和用户任务的运行断言；没有对应证据时将审阅标为不完整，并单列未满足的业务验收。
- 重复工具调用不得重复计算成多份净差异。按 operationId/目标去重并保留所有源回执；同一目标有连续变更时显示有序操作链，最终值以最新成功读回为准。

## 任务权限模型

0.1 保留 Ask/Plan 只读与 Agent 写入逐次批准。候选的任务级权限只能作为一次 run 内的可撤销授权范围，至少绑定：

- 当前规范化项目根与 Creator 2.4.15 实例身份；
- 本 run/计划 ID、批准的目标文件相对路径或编辑器对象 UUID/路径；
- 允许的命令/操作类别及读写等级；
- 明确排除的范围（例如运行时网络、副作用服务或目标外资源）；
- 失效时间、撤销行为和是否允许 checkpoint 创建。

实际分发时仍逐命令校验该范围；工具新增参数、目标身份改变、能力目录变化、项目约定哈希变化或超范围写入都重新要求用户批准。批准计划、批准 checkpoint、批准写入和业务成功验收是不同事实。取消立即撤销后续调度授权；已分发命令等回执，不承诺中止或自动回滚。0.1 不持久授予跨 run/重启写权限，不提供“始终允许全部”的全局模式。

## Checkpoint 设计

- checkpoint 必须由用户在本任务明确选择启用；不自动 `git stash`、`reset`、`checkout`、覆盖目录或回滚整个项目。
- 元数据与受限快照放在项目外、按规范化项目路径哈希隔离的用户状态目录，文件权限遵循现有 `0600`/目录 `0700`。不存模型密钥、截图、完整聊天或未授权目标文件。
- Checkpoint 只捕获用户授权范围内会被本任务修改的基线目标，保留原文件是否存在、精确字节 SHA-256、必要的受限恢复数据、Creator UUID/对象身份、runId、操作 ID 和创建时间。开始前的未提交用户内容可作为恢复基线，但不得纳入范围外内容。
- 恢复遵循 compare-before-restore：目标当前字节/对象状态精确等于本任务成功写入后的哈希/值，才可提出基于该 operation 的恢复；若当前已等于基线，报告已恢复/无变化；任何第三种状态、路径/UUID 改变、引用变化或 Creator 与磁盘状态不一致均标为 conflict 并停止，绝不覆盖。
- 新建文件仅可在其仍与该 run 写入哈希一致、未被其他资源引用且 importer 身份可核对时删除。Creator 资源、场景和 Prefab 优先通过其受限 Creator 命令与 operation compensation 恢复，不直接还原序列化目录快照。场景未保存状态用 Creator 实时读回和账本判断；磁盘 checkpoint 不能代表编辑器内存状态。
- Checkpoint 保留期限、清理和大文件/二进制策略须实现前定义。checkpoint 读取也核对 project key 与路径身份；损坏/不完整状态 fail closed。

## 取消、中断、重启及恢复冲突

| 事件 | 0.1 行为 |
| --- | --- |
| 用户取消、没有正在执行的工具 | 取消模型请求，阻止新工具调用，run 标记 cancelled；不回滚 |
| 取消时 Creator 命令已分发 | 等待该调用回执，持久化实际阶段和 operationId，然后停止后续调度；结果未知则 needs-review |
| Host/Creator 进程重启，只有只读回执 | 标记 interrupted/paused；恢复前重选 ready 实例并重查能力、项目约定和目标 |
| 重启时正执行写入，或写入后最终状态未持久化 | 标记 needs-review 并锁住新的写入；按原 operationId 只读对账，不重放 |
| 当前值精确匹配 operation after 值 | 可按原合同请求补偿；恢复完成后再读 Creator 与磁盘 |
| 当前值精确匹配 before 值 | 记录 no-effect/already-restored；不重复写 |
| 当前值与 before/after 都不同或身份不匹配 | 标记 conflict，展示当前值与原始回执；禁止补偿、checkpoint 覆盖和新 ID replay，先由用户解决冲突 |

每个恢复动作产生独立 operation 记录并关联原 operationId。取消不等于回滚；状态存储、JSONL 轨迹和 checkpoint 都不能代替编辑器、磁盘及业务结果的真实读回。

## 当前实现

Agent Host 已将会话/计划/run 按工程隔离保存到用户目录；服务重启时只读任务标记为 interrupted，存在活动/已记录写入时标记为 needs-review。面板取消会等待当前 MCP 写回执，阻止后续模型/工具；最近任务允许按原 operationId 只读核对，不自动 reconcile/compensate/replay。取消、重启和 operation receipt 等路径已有历史自动化覆盖，但当前 M4 修改未运行测试、未做 Creator 面板实机验收。

新增任务审阅卡将现有 run receipts 分为代码、场景/Prefab 和其他写入，保留回执给出的差异与 operationId；状态通过 run state 持久化并在 Host 重启后重建。它明确标注 `receipt-scope-only`，尚未对项目 Git 状态或全部磁盘文件做任务级差异扫描，也未提供 checkpoint 创建/恢复按钮。
