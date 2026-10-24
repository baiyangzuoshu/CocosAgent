# Cocos CLI 场景组件属性来源绑定补偿验收（Creator 2.4.15）

本记录验证场景组件属性写入可通过原始 operation ID 派生唯一补偿计划。CLI 不接受调用方自选恢复值；补偿计划绑定源 operation、源 plan hash、精确场景/节点/组件/属性身份，并在 Creator 重开后以磁盘和实时状态校验前态。

## 工程与版本

- 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 2.4.15，当前复验使用 CLI 0.12.57、扩展 0.8.88。初始 0.8.87 验收记录保留在下文；当前版本另完成一轮全流程复验。
- 场景：`CliAcceptanceScene`，UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`。
- 节点：`CliAcceptanceScene/Canvas/CliSliderTest`，UUID `07762af0-78a7-4529-9cff-846c1a39d6e0`。
- 组件：`cc.Slider`，实例 ID `b6IBIFAiJDYpWDT9COncUZ`，属性 `progress`，Creator Inspector 范围 0–1、步进 0.1。

## 闭环

1. Apply operation `faa0b204-bb67-4025-a878-5b9c0f1220e6`（plan hash `5f418a537d28385663f1d3e77486b3994f6af974049761046fe0d4f4b4648008`）将 `progress` 从 0.25 改为 0.4。Creator 回执确认 `.fire` 磁盘读回为 0.4，场景 SHA `c3cb0ca1bd097667022b2b65e58706cc73d4a91e550a68016d21395d7caf143c`，`.meta` SHA `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。
2. CLI 关闭并重开整个工程，Creator 2.4.15 / 扩展 0.8.87 / 工程路径及活动场景均匹配。以源 operation ID 生成补偿 operation `de3c3b63-49b1-4b5c-811d-8341085ce9b2`（plan hash `4addc4f091e36200667327cda5fab5815eec4406bec4675b49299c5966046dea`）。返回的 `compensationFor` 指向源 operation 和 plan hash，计划值为观察到的 0.4→源 before 值 0.25。
3. 提交补偿后 Creator 磁盘读回确认 `_N$progress=0.25`，场景 SHA 恢复为基线 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`，`.meta` 未变化。再次经 CLI 整工程关闭/重开，新实例 `b55d24c3-a305-4358-b577-6b981f684eef` 的 `creator.project.info` 和 `creator.scene.ui.inspect` 读回同一工程、场景、Slider 实例及 `progress=0.25`；磁盘 `.fire` 与 `.meta` 哈希均为基线。
4. 使用同一源 operation 再请求补偿计划，CLI 拒绝并返回 `SCENE_COMPONENT_COMPENSATION_SOURCE_NOT_ELIGIBLE`，没有创建第二个补偿。

CLI 0.12.56 全量测试 354/354 通过。验收覆盖 `cc.Slider.progress` 的数值标量及单次来源补偿；其他组件、资源引用和 typed array 补偿仍需分别实测。Creator 场景保存 IPC 本身不提供完成确认；本记录依据 Creator commit 的精确 `.fire` 读回和关闭/重开后的 CLI Inspector 读回判定持久化。

## 0.8.88 跨重启 reconcile 复验

升级 CLI 扩展到 0.8.88 后，通过 CLI 确认工程 `/Users/youjunmao/WORK/Cocos_Engine/tank`、Creator 2.4.15、活动场景 `CliAcceptanceScene`。此前 0.8.87 创建的旧 operation 因合同指纹变化返回 `OPERATION_CONTRACT_MISMATCH`，未重放或修改场景；为当前合同重新执行完整流程：

1. operation `be6317cf-fbd3-4a96-9d6e-dc8cfe10639a`（plan hash `7a6f5592efa85fce8b1434d875c05b932f71101e9dbc99e463a56c5e664ad64e`）将 `progress` 从 0.25 改为 0.4，Creator 保存读回成功，场景 SHA 为 `c3cb0ca1bd097667022b2b65e58706cc73d4a91e550a68016d21395d7caf143c`。
2. CLI 关闭并重开工程，新实例 `be81a3f2-3e79-4f78-8072-a19d8125f88c` 上，由来源 operation 派生补偿 `969557c3-60a7-4a8e-abe1-3bb1959cc254`（plan hash `2d794dbc4a8b36de330e074f8ca414e58c85e3cd28d07c00c59443ddf02cbcdf`），计划只允许 0.4→0.25。提交后 Creator 精确读回 0.25，场景 SHA 恢复基线 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`。
3. 再次由 CLI 关闭并重开，实例 `4268ab1b-5370-44a6-a722-a6dcdaffde23` 的 `creator.project.info` 和 `creator.scene.ui.inspect` 均确认工程、Creator 版本、场景、Slider 实例和 `progress=0.25`。补偿 reconcile 返回 `completed`、`sameCreatorSessionRequired=false`、`matchesAfter=true`，并报告 `.fire` SHA `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74` 和 `.meta` SHA `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。

CLI 0.12.57 的完整测试 **354/354 通过**。跨重启 reconcile 只对绑定来源、已完成的补偿 operation 开启：当前精确组件身份无法解析或 live/disk 状态不匹配时不会确认完成，也不会重放变更。属性类型覆盖仍限于 `cc.Slider.progress` 数值标量。
