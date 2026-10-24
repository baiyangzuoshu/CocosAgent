# Creator CLI ProgressBar 属性往返验收（2026-10-24）

## 目标与身份

- 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`
- Creator：2.4.15；扩展：0.8.72
- 场景：`CliAcceptanceScene`，scene UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`
- 节点：`CliProgressBarTest`，node UUID `60b93f4f-8329-4619-83c5-365bbf50e9df`
- 组件：`cc.ProgressBar`，component UUID `9audFc1QZHOacPs9VtFhB1`

## 写入、运行时检查与补偿

1. 原始值 `progress=0.5`；场景 `.fire` SHA-256 为 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`，`.meta` 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。
2. CLI 计划/提交 `progress=0.5→0.75`：operation `3c33a908-b067-4d00-9065-f2441a8a1fe2`，plan hash `545feb081973a5bc4bb0a19cc815a1f1b0f69a4efab631193d50f38190f457e4`。Creator 磁盘读回确认同一组件 UUID、序列化键 `_N$progress` 和值 `0.75`；场景 SHA-256 变为 `3c2d6a46436f5608acbc6ee30d0ef942661806430d198f0619ebf2dfeefef008`，`.meta` 不变。
3. 扩展 CLI 预览断言的安全字段读取映射：只从 Creator 实例自身 `_N$progress` 数据字段读取，不调用 `progress` getter。Creator 2.4.15 源码将该属性声明为 0–1 范围的数值字段；单测用抛错 getter 确认断言不会执行组件 getter。
4. CLI 预览会话 `4e910b70-1f2a-4a8a-a44d-d27be1bbc38d` 中，场景 UUID、无新增运行时错误和 `cc.ProgressBar.progress===0.75` 三项断言通过。断言之前识别到桥接服务仍载入旧模块；通过 CLI 停止预览、停止桥接并以工作区 CLI 重启后重新开预览，才得到通过回执。
5. CLI 关闭并重开后，Creator 2.4.15 / 扩展 0.8.72 握手成功，实例 `421b68d1-9f05-4df5-a5c7-8fb1ab2a060d` 的场景快照读回 `progress=0.75`。
6. CLI 计划/提交来源补偿 `0.75→0.5`：operation `f2c1c36a-262f-40d8-bdf0-7af2f2fce03f`，plan hash `d2ee5dac30dbda386741e197df6fed3fbacaf1ae9c1dbbb7e9f0d8f8ca934b9b`。保存读回确认 `_N$progress=0.5`，场景 SHA-256 回到原基线，`.meta` 未变。
7. 补偿后再由 CLI 关闭并重开。实例 `b75619d1-17a0-48ed-945b-6e7fa59a0487` 返回工程路径、Creator 版本、扩展版本和场景身份；场景快照读回 `progress=0.5`，两个哈希仍为原基线。

## 结果边界

`cc.ProgressBar.progress` 标量属性在 Creator 2.4.15 中已完成 CLI 计划、提交、运行时属性断言、关闭重开读回、来源补偿和再次重开验收。本夹具的 `barSprite` 为空，因此没有可见填充资源，本轮不宣称进度条的实际图形呈现通过。没有桌面 UI 自动化。
