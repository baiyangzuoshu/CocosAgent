# Cocos CLI `cc.ScrollView.content` 实机验收

日期：2026-10-24
工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`
Creator：2.4.15
项目扩展：0.8.94
场景：`CliAcceptanceScene`，UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`
目标节点：`CliScrollViewTest`，UUID `e5208b4b-2097-4b32-a721-e5065b5617eb`
组件实例：`cc.ScrollView` / `ccA83T4olHbp1ovdLAxcn7`

## 目标与结果

验证 CLI 是否能把 `cc.ScrollView.content` 设置为活动场景中的节点引用、在编辑器重启后读回，并通过来源补偿恢复默认空引用。操作均通过 Cocos Creator CLI/MCP 命令完成；没有使用电脑 UI 自动化，也没有手改 `.fire` 或 `.meta`。

## 操作证据

1. 基线 Inspector 将 `content` 报告为 `node-ref` 空值；Creator 保存文件中该默认 null 字段被省略。CLI 计划之前会把 Inspector 的空引用与磁盘省略字段判为状态不匹配。
2. 更新扩展后，CLI 计划接受 Inspector 已核实的 null 作为省略字段默认值，并冻结 Inspector 提供的精确序列化属性名。计划 ID `92a41056-f290-48f1-97a8-5c3d594e525d`，计划哈希 `21d646482f8409132e669e3b1d355ba16e0ddd0cceacc7e424531552cb6c4768`；目标 Content 节点 UUID `23384298-d1fe-4431-9447-bd5e63338e05`。
3. CLI 提交成功并确认磁盘持久化；Creator 2.4.15 关闭并由 CLI 重开后，场景层级读回该 Content 节点及其父节点关系，ScrollView `content` 指向该节点。提交后场景 SHA-256 为 `944f9b7abd5abe3cfb9f7d1c6a263d6412d1aaa560c20177a83e5e9b39f609d8`；`.meta` SHA-256 保持 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。
4. 扩展 0.8.93 的来源补偿计划和提交成功，将 `content` 设回空引用。该轮 Creator 磁盘读回为 `_N$content: null`，场景 SHA-256 为 `652b8cf14b61789956b60e5ac14dacb9f24000bc6fedebd8d82f5fcd9084864a`，因此该轮真实引擎操作证明了语义默认值恢复，但没有恢复到原先省略字段的逐字节哈希。
5. 为支持精确恢复，CLI 增加了来源计划 `isDefaultOmitted` 标记、写入 `undefined` 以恢复 Creator 默认省略的处理，以及对应磁盘读回检查。扩展 0.8.94 的单测验证 apply→compensate 后 `.fire` SHA-256 完全恢复到基线。
6. 为清除验收夹具，通过 CLI 计划并删除临时 Content 节点：删除操作 ID `0ba3672a-28ac-4c1e-9379-b89312ca3274`，磁盘读回确认 UUID 缺失；删除后场景 SHA-256 为 `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593`，`.meta` SHA-256 仍为上述值。
7. 按流程通过 Cocos CLI 关闭工程（PID `32153`，退出成功）并重新打开。CLI 报告 `editorReady=true`、工程绝对路径正确、Creator 2.4.15、扩展 0.8.94。重开后的场景快照读到 `CliScrollViewTest` 子节点数为 0，ScrollView `content=null`，水平滚动开启、垂直滚动关闭、惯性开启；场景共 23 个 authoring 节点，临时 UUID 不在场景中。

## 代码验证与限制

- `test/script-modify.test.mjs` 新增覆盖：Creator 省略 null typed reference 时可以计划写入；来源补偿可将该字段恢复为省略状态并恢复原始场景哈希。
- 当前测试覆盖不等于 Creator 实机验证。0.8.94 的精确省略状态恢复尚未在实机重新执行；本轮真实 Creator 补偿是 0.8.93，实际读回显式 null。重开后的空引用与临时节点清理已用 0.8.94 实机核验。
- 本记录只验收 `content` 属性读写及其 CLI 持久化/补偿流程，不代表 ScrollView 滚动手势、Content 尺寸布局、惯性运行时表现、事件触发或 Scrollbar 联动已验收。
