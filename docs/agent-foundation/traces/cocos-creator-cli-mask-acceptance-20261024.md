# Creator CLI Mask 反向属性往返验收（2026-10-24）

## 目标与身份

- 工程：`/Users/youjunmao/WORK/Cocos_Engine/tank`
- Creator：2.4.15；扩展：0.8.72
- 场景：`CliAcceptanceScene`，scene UUID `2c12110c-6f11-4a89-bcd4-1941dc757ca4`
- 节点：`CliMaskTest`，node UUID `918755f8-2a55-45ba-90d7-c986a0448b72`
- 组件：`cc.Mask`，component UUID `aeyMrXRv1Osq0D3mmUq2ii`

## 写入、重开与补偿

1. 原始 `inverted=false`；场景 `.fire` SHA-256 为 `cd1bd3f3ec214e31335ad1aaf73f71155f6717955586327b5d51ce0f71771f74`，`.meta` 为 `269c764bf220a82d50babe7e47ad58f815765e8c4821c2293d5b304478fd7cba`。
2. CLI 计划/提交 `inverted=false→true`：operation `dbdf2430-ca46-4a80-99d3-5be0e3903d5c`，plan hash `eada2546f3efa21c6a6fcf6f81f0ccd3b84eb984a31bfc2e973e5d6fb7db943b`。Creator 磁盘读回确认同一组件 UUID、序列化字段 `_N$inverted=true`；场景 SHA-256 变为 `2dfacb6c7c645706abc1a7df2bfa131daf7b2a18643d1a22c5647b3ae682a3ad`，`.meta` 不变。
3. CLI 关闭并重开。实例 `0cb6360b-b50b-404d-8ddd-354d6e5ede31` 的项目状态确认工程路径、Creator 2.4.15、扩展 0.8.72 和场景 UUID；场景快照读回 `inverted=true`。
4. CLI 计划/提交补偿 `true→false`：operation `6fdc6233-df37-4bdf-9d5c-80106df77bd4`，plan hash `36285a23b3caadfef381e6742af5d522b08be782498f85ab607dbcab53e2f4ae`。Creator 磁盘读回确认 `_N$inverted=false`，场景哈希回到原基线，`.meta` 未变。
5. 补偿后再次由 CLI 关闭并重开。实例 `d35cf0a0-1d09-4699-a58b-e9e50764ae4f` 返回匹配的工程身份；场景快照读回 `inverted=false`，场景和 `.meta` 哈希均回到基线。

## 结果边界

`cc.Mask.inverted` 布尔属性已通过 Creator 2.4.15 的 CLI 计划、写入、关闭重开读回、来源补偿和最终重开验收。该夹具没有子节点和 SpriteFrame，因此没有验证 Mask 裁切、反向渲染或资源引用的可视行为。全程通过 Cocos CLI 操作 Creator，没有桌面 UI 自动化。
