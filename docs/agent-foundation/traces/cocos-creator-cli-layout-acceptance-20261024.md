# Creator CLI Layout 间距与重开验收（2026-10-24）

## 目标与身份

- 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`
- Creator：2.4.15；扩展：0.8.72
- 场景：`CliAcceptanceScene`，scene UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`
- 布局节点：`CliLayoutTest`，node UUID `d77e9d7e-5b73-4bb1-88d4-df5654ccc3a3`
- 组件：`cc.Layout`，component UUID `edg9tFEsROhr/mNDQ2QvsK`
- 子节点 A：UUID `5946bc1d-c19e-43b3-82ef-271db36f5e6d`；子节点 B：UUID `32545051-677f-4759-9d59-e6a391eaa391`

## 写入、运行时检查与补偿

1. 原始状态为 `spacingY=10`，纵向 top-to-bottom，A=`y85`、B=`y45`。保存场景基线 SHA-256 为 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`，`.meta` 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。
2. CLI 计划并提交 `spacingY=10→20`：operation `6a46f174-c891-49a2-841a-abb2bf25fd48`，plan hash `1584b74abfc754b7cf35b15634339378776c9146700aa780634d560df05746d6`。Creator 保存后序列化 `_N$spacingY=20`，场景哈希变为 `73a7d620645ec5f57a22d03c78e5a611f0d4ef127e7bcf48c2e8216c8ab3b392`，`.meta` 不变。
3. CLI 预览会话 `73494c24-86ac-4373-8424-b1585218a5a6` 对 `CliLayoutTest` 调用 `cc.Layout.updateLayout()`，并断言无运行时错误、场景身份、`spacingY=20`、A=`y85`、B=`y35`，断言全部通过。显式刷新回执的 `changed:false`；Creator 在预览启动时已应用保存的布局，所以该次调用没有再改变几何。此记录只证明预览状态和断言通过，不声称显式刷新改变了位置。
4. CLI 关闭并重开后，Creator 2.4.15 / 扩展 0.8.72 握手成功。CLI 场景快照读回 `_N$spacingY=20`、A=`y85`、B=`y35`。
5. CLI 补偿计划/提交 `spacingY=20→10`：operation `d07a7e28-935c-4c6f-ace8-4cbe9a5fa34a`，plan hash `9c1876e61956758840ea620e2f2fc082b717c8f31b1155739685b24b7adc2392`。`creator.scene.node.set-component-property.reconcile` 确认状态 `completed`，磁盘属性为 10，场景和 `.meta` 哈希恢复到原基线。
6. 补偿后再次由 CLI 关闭工程，确认进程退出；CLI 重开返回 `editorReady=true`，新实例 `f560af24-60f4-4057-b030-53043654df96`。`creator.project.info` 核对工程路径、Creator 2.4.15、扩展 0.8.72 和场景 UUID；场景快照读回 `spacingY=10`、A=`y85`、B=`y45`。只读文件哈希再次等于基线值。

## 结果边界

`cc.Layout.spacingY` 单字段写入、预览属性/几何断言、关闭重开读回、来源补偿和基线恢复已通过 Creator 2.4.15 / 纯 Cocos CLI 验收。显式 `ui-refresh` 执行时布局几何已由预览启动阶段应用，故 `changed:false`；后续需设计可观察的运行时输入变化来单独验证刷新调用会触发布局。横向布局、padding、Resize Mode 和其它布局字段仍未验收。
