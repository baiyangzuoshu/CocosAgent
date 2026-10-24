# Creator CLI Scrollbar 属性往返验收（2026-10-24）

## 目标与身份

- 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`
- Creator：2.4.15；扩展：0.8.72
- 场景：`CliAcceptanceScene`，scene UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`
- 节点：`CliScrollbarTest`，node UUID `038d0675-c353-4d91-8cc8-4888bed0ad6b`
- 组件：`cc.Scrollbar`，component UUID `98GJIt521JZrEZ93HTSO1p`

## 写入、重开与补偿

1. 原始 `autoHideTime=0.5`；场景 `.fire` SHA-256 为 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`，`.meta` 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。
2. CLI 计划/提交 `autoHideTime=0.5→0.75`：operation `da37d548-2931-4a77-a637-c9c6478b07b3`，plan hash `b083cbfe3f41682a044c8017a4ebc17cdce18020ecae51b48db174dec78190fc`。Creator 磁盘读回确认同一组件 UUID、序列化字段 `autoHideTime=0.75`；场景哈希变为 `e084160956e50b5445c9df02b9914794f244fde243d0df6ae9ed0503a8783515`，`.meta` 不变。
3. CLI 关闭并重开。新实例 `b6716c17-6f3c-4501-a968-ad8be373ad89` 的项目状态确认 Tank、Creator 2.4.15、扩展 0.8.72 和验收场景 UUID；场景快照读回 `autoHideTime=0.75`。
4. CLI 计划/提交补偿 `0.75→0.5`：operation `5a1b6ffe-8ea9-40a8-ab6b-5ec137caef56`，plan hash `5bb44ce60f08ec266fb9c2f5762cf6c4b7a25bc029eb9a4da4f4a9a9fc68ffdc`。Creator 磁盘读回确认字段恢复为 0.5，场景 SHA-256 回到原基线，`.meta` 未变。
5. 补偿后再次由 CLI 关闭并重开。实例 `b2f71578-db00-4ccc-97aa-024d4a7678f4` 返回匹配的工程身份；场景快照读回 `autoHideTime=0.5`，场景和 `.meta` 哈希均回到基线。

## 结果边界

`cc.Scrollbar.autoHideTime` 数值属性已通过 Creator 2.4.15 的 CLI 计划、写入、关闭重开读回、补偿和再次重开验收。Tank 夹具中的 `handle` 为空，且没有关联 `ScrollView`；没有验证自动隐藏、滚动交互或可见滚动条效果。全程通过 Cocos CLI 操作 Creator，没有桌面 UI 自动化。
