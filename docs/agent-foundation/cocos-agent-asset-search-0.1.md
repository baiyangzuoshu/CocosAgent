# CocosAgent PNG 资源发现合同 0.1

## 范围

`asset.searchPng` 是 Creator **2.4.15** 的只读语义命令。它用于 Agent 先发现已导入 PNG 的编辑器身份，再决定后续是否把 SpriteFrame 引用到场景。3.8 不实现此命令。

扩展调用 Creator 2.4 [`Editor.assetdb.queryAssets`](https://docs.cocos.com/creator/2.4/manual/zh/extension/api/asset-db/asset-db-renderer.html)，按 `texture` 类型查询 AssetDB 中 PNG 主资源，再用 `.meta` 交叉核对磁盘身份。AssetDB 返回 `url`、`path`、`uuid`、`type` 和 `isSubAsset`；查询不修改资源或场景。

## 输入

```json
{
  "query": "cocos-agent",
  "limit": 20,
  "offset": 0
}
```

- `query` 必填，1–80 字符；按文件名或项目相对 URL 片段做不区分大小写的子串查询。
- `limit` 可选，默认 20，范围 1–50。
- `offset` 可选，默认 0，范围 0–100000。
- 不接受其他字段、控制字符或 Creator 3.8 目标。

## 执行顺序

1. Host 先列出实例、选择精确的 2.4.15 工程，再检查 `asset.searchPng` 为 `available`。
2. 扩展握手声明只读合同与 AssetDB 查询实现。Host 验证版本、实例、查询合同与随机 nonce。
3. Host 直接发送 `asset.searchPng`，不要求活动场景快照。
4. 扩展查询 PNG Texture 主资源，按 URL 稳定排序并分页。每项读取对应 `.meta`，核对 Texture UUID 和 SpriteFrame 子资源 UUID。
5. Host 校验结果的工程身份、会话 nonce、分页、URL 形态、UUID、尺寸和元数据状态后，输出结构化 `command.result`。

## 返回

```json
{
  "query": "cocos-agent",
  "total": 1,
  "offset": 0,
  "limit": 20,
  "nextOffset": null,
  "items": [{
    "name": "cocos-agent-smoke.png",
    "url": "db://assets/resources/cocos-agent-smoke.png",
    "type": "texture",
    "textureUuid": "be74f85d-2ff1-472e-9d9c-571605318daf",
    "spriteFrameUuid": "bf3ac0aa-a2b4-4806-b5c7-740be92924c3",
    "width": 2,
    "height": 2,
    "metadataStatus": "valid"
  }]
}
```

`textureUuid` 和 `spriteFrameUuid` 是不同身份。只有 `metadataStatus: valid` 才会返回 SpriteFrame UUID；Agent 可以把这个 UUID 传给 2.4 `scene.node.create` 的 `cc.Sprite` 组件输入。其他状态不允许据此创建 Sprite：

- `sprite-frame-unavailable`：Texture 身份匹配，但不存在唯一且关联正确的 SpriteFrame 子资源。
- `identity-mismatch`：磁盘 `.meta` 的 importer 或 Texture UUID 与 AssetDB 不一致。
- `metadata-unavailable`：资源路径、文件或 `.meta` 无法安全读取或解析。

每个资源条目只暴露 `db://assets/...` 项目相对 URL，不回传资源磁盘绝对路径；外层实例回执仍带所选工程根目录身份。输出按 `limit` 有界；AssetDB API 当前先返回匹配类型的完整查询结果，再在扩展中筛选和分页，因此大型工程的查询耗时仍需实测。

## 错误与验收状态

- `COMMAND_UNAVAILABLE`：目标不是 Creator 2.4.15，或当前能力目录不支持命令。
- `ASSETDB_UNAVAILABLE`：查询时扩展未检测到 `Editor.assetdb.queryAssets`。
- `ASSET_QUERY_FAILED`：AssetDB 查询或回调失败。
- `CAPABILITY_CATALOG_INVALID`：运行中的扩展目录与当前 Host 合同版本不一致；刷新/重载扩展后重试能力查询。

本切片的 MCP schema、实例分发、Host WebSocket 协议模拟和技能结构校验已通过。当前 Creator 2.4 实机仍载入旧能力目录，故真实 AssetDB 结果及元数据状态尚未实机验收；失败发生在命令执行前，没有触及场景或资源。模拟与聚焦测试可用 `node tools/cocos-agent-bridge/asset-search-host.mock-test.js`、`node tools/cocos-agent-bridge/catalog-extension-contract.test.js`、`node tools/cocos-agent-bridge/agent-dispatch.test.js` 及 `cd tools/cocos-agent-bridge/mcp && npm test` 重跑。

实现：`2.4.15NewProject/packages/cocos-agent-bridge/main.js`、`tools/cocos-agent-bridge/bridge-host.js`、`tools/cocos-agent-bridge/agent-dispatch.js`、`tools/cocos-agent-bridge/catalog-host.js` 与 `tools/cocos-agent-bridge/mcp/mcp-server.mjs`。
