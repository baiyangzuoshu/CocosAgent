# Prefab 空节点/组件引用读回与往返验收（2026-10-25）

## 环境与目标

- 工程：Tank，`/Users/youjunmao/WORK/Cocos_Engine/tank`
- Creator：2.4.15
- CLI：0.12.62
- 扩展：0.8.110（该轮实现；整工程最终重开时为 0.8.111）
- 操作：Cocos CLI 与 Creator 扩展；未使用电脑 UI 自动化，未直接编辑 `.prefab` 或 `.meta`。
- Prefab：`db://assets/Button.prefab`，AssetDB UUID `b657e4bb-78f2-4ba4-b066-600ffb10e4f2`
- 属性：根节点 Button 的 `cc.Button.target`，序列化键 `_N$target`
- 目标节点：`Button/Label`，Prefab 稳定节点 ID `845wZbBqlAQ4ZQ5F5jnIwD`
- Button 组件稳定身份：`prefab_component_e82fcad3b9715fb929508663`，组件索引 1

## 缺陷与修复

Creator Prefab Inspector 将空 `target` 报告为 `{ kind: "node-ref" }`，保存序列化文件则将 `_N$target` 表达为 `null`。旧读回逻辑只给 null AssetDB 资源恢复声明类型，没有给节点/组件引用恢复类型。试验中，按 Inspector 形状提交的计划越过了 Creator 实时前置检查、随后被磁盘读回判为 `PREFAB_SOURCE_STALE`；若将 `before` 改为原始 `null`，则被实时检查以 `PREFAB_EXPECTED_STATE_MISMATCH` 拒绝。两个拒绝均未写入 Prefab。

扩展 0.8.110 在带类型的预期值声明 `node-ref` 或 `component-ref` 时，将磁盘 null 规范化为对应空引用值；`component-ref` 同时保留预期组件类名。新增自动化回归 `Prefab source readback preserves typed empty node and component references`，验证保存文件中的两个 null 字段能与 Creator typed-empty 表示一致匹配。

## Creator 2.4.15 实机往返

基线 Prefab SHA-256：`145fe80ab8a84e7161f7721628373a18292b72ba6410d8a391992048b91465dd`。CLI Inspector 读到 `cc.Button.target` 当前为空引用，且声明序列化键 `_N$target`；根节点组件、Prefab UUID 与 `Button/Label` 稳定节点 ID 已精确核验。

写入计划 ID `85ea6195-094e-4c8c-85ec-a77f1cc1d5a5`，计划哈希 `c6698695b276ef6a4928a9fb5a23c247086ea563d5babee9f0f6983d24982c63`。该计划把空 node-ref 改为同一 Prefab 的 `Button/Label` 节点引用。Creator Prefab 模式提交完成并退出、重开；磁盘源 SHA-256 变为 `f1474dc761e55db27ee95ccac36c16c969ec856f043a4ecd3a35506bb0fd4ea2`，`.meta` 哈希仍为 `c926c945705ee5f8ef09f855d8b451392d8744cdb1238a3f8783f7098990a29a`。随后 CLI Prefab Inspector 读回 `target.nodeUuid=845wZbBqlAQ4ZQ5F5jnIwD`。

来源补偿计划 ID `6cee4c69-54cd-4341-8ec3-750fe1a39f50`，计划哈希 `4f453ac3373dfb418397fb13d438d4e4e9e1f19489a8a9861293ec02ef1519c0`，来源操作为 `85ea6195-094e-4c8c-85ec-a77f1cc1d5a5`。Creator 提交、退出并重开 Prefab 后，补偿确认成功，Prefab SHA-256 精确恢复至基线 `145fe80…65dd`，`.meta` 未变。

最后由 Cocos CLI 关闭整工程，确认进程退出和桥接断开，再由 CLI 重开。新实例 `77c50cf5-564b-4b52-bcb9-044ce5dad78e` 的 `creator.project.info` 确认工程绝对路径、Creator 2.4.15、扩展 0.8.110 与活动场景。重开后的 Prefab 源检查及 Creator Prefab Inspector 均确认 Button 组件/节点身份不变、`target` 恢复 typed empty node-ref。最终哈希：

| 文件 | 最终 SHA-256 |
| --- | --- |
| `assets/Button.prefab` | `145fe80ab8a84e7161f7721628373a18292b72ba6410d8a391992048b91465dd` |
| `assets/Button.prefab.meta` | `c926c945705ee5f8ef09f855d8b451392d8744cdb1238a3f8783f7098990a29a` |
| `assets/CliAcceptanceScene.fire` | `6430689d65141a17e5a3eacdd39bb502ecbee33390ef1c1ca7365661e80b3593` |
| `assets/CliAcceptanceScene.fire.meta` | `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba` |

## 回归与范围

- 新增 Prefab source patch 单测：通过。
- CLI 全量自动化测试：该轮 370/370 通过；当前扩展 .111 下全量 371/371 通过。
- `git diff --check`：通过。
- 实机覆盖 `cc.Button.target` 单个 Prefab 内节点引用的空值→引用→来源补偿；不代表其他节点/组件引用字段、引用数组或任意 Prefab 字段均已验收。
