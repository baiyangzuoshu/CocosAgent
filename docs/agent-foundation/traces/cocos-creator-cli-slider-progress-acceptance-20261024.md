# Cocos CLI Slider progress 验收（Creator 2.4.15）

本记录验证 `cc.Slider.progress` 可经 Cocos CLI 修改，整工程关闭/重开后读回，并用精确反向属性计划恢复原值。全程未使用桌面 UI 自动化。

## 工程与目标

- 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`，Creator 2.4.15，CLI 0.12.56，扩展 0.8.86。
- 场景：`CliAcceptanceScene`，UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`。
- 节点：`CliAcceptanceScene/Canvas/CliSliderTest`，UUID `07762af0-78a7-4529-9cff-846c1a39d6e0`。
- 组件：`cc.Slider`，组件 ID `b6IBIFAiJDYpWDT9COncUZ`；Inspector 声明 `progress` 为 Float，范围 0–1、步进 0.1；`handle` 为空，`slideEvents` 为空。

## 操作与证据

1. Creator 实例 `8fdc0215-2a47-4441-9c9e-93e3fd38a2b6` 上，CLI Inspector 读到 `progress=0.25`。计划 `bad88eb1-3187-4719-b6b5-20b694c68aeb`（hash `b4c1e58952c7724b67e52bc39745bdf3cfb30ca6387c2c8676b8e77177976f00`）将其设为 0.6；commit 返回 `scenePersistenceConfirmed=true`，磁盘字段 `_N$progress=0.6`，场景 SHA 从基线 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74` 变为 `30998f7315fa1b0de2d9435e885d688ad2e28c1da1157489f5fadb08809aa38b`。`.meta` 始终为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。
2. CLI `project close` 确认进程退出且桥接断开；`project open` 报告 `editorReady=true`，新实例为 `c60c7013-3be6-47f7-8c9e-93e3fd38a2b6`。`creator.project.info` 核对同一绝对路径、Creator 2.4.15 和目标场景；`creator.scene.ui.inspect` 与 `.fire` 均读回 `progress=0.6`。
3. 新实例上以反向计划 `ec10f571-d271-4fcb-921d-c138152660e7`（hash `c25dd3a38ee379cfd58eeeed5357c7e826ea7c946eb9739cd4a881046b997d77`）恢复为 0.25。commit 读回 `_N$progress=0.25`，场景 SHA 回到基线 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`，`.meta` 哈希不变。
4. 再次由 CLI 整工程关闭/重开，新实例 `1dcd787d-5e5e-494e-bfff-fe2187743bd0` 的 `creator.project.info`、`creator.scene.node.read`、`creator.scene.ui.inspect` 均确认工程、场景、节点、组件 ID 不变，`progress=0.25`。磁盘 `.fire` 与 `.meta` 哈希均恢复到记录基线。

## 结论与限制

`progress` 标量属性在 Creator 2.4.15 中已通过 CLI 计划、提交、关闭/重开读回和精确反向计划恢复。恢复是新建的反向属性操作，不是与原 operation ID 自动关联的专用补偿命令。测试夹具没有 handle，因此不证明滑块视觉填充、拖动或 `slideEvents` 行为；这些仍需另项验收。
