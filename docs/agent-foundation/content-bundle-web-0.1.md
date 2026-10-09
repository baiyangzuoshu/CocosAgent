# Cocos Creator 2.4 Web-Mobile Asset Bundle 内容合同 0.1

本文记录 CocosAgent 对 Creator 2.4.15 本机 Web-Mobile Asset Bundle 的有限支持。它扩展现有 release/build/preview 合同，不代表 3.8、外置下载、远端发布、小游戏或原生热更新。

## 流程

1. `content.bundle.plan` 只读检查已由 Creator 导入的 PNG、Bundle 文件夹 `.meta`、本地 Bundle 名、源字节摘要、Texture UUID、唯一 SpriteFrame UUID 及资源依赖。
2. `content.bundle.stage` 将校验通过的清单写成不可变 release，不改变 `selected`、不启动构建。
3. `content.select` 显式选择 release；当前实现按 Creator 2.4.15 项目记录拒绝重复的 Bundle 名，避免 `loadBundle` 命中同名旧缓存。
4. `content.build.plan/execute/get` 使用新的 `buildId` 与隔离 Web-Mobile 输出。包校验要求目标 Bundle config、Texture 和 SpriteFrame 压缩 UUID、SpriteFrame 到 Texture 的 import 依赖，以及 native PNG 都匹配 release。
5. `content.preview.start/get/stop` 仅在所选 release 与构建记录一致时启动。运行时使用 `cc.assetManager.loadBundle`，再用 `bundle.load(path, cc.Texture2D)` 按需载入纹理；加载失败保留当前 SpriteFrame，不盲目重试相同指纹。
6. 成功绘制新帧后才释放旧资源。切换到另一 Bundle 时随后移除旧 Bundle 缓存；显式 `content.select`/`content.rollback` 产生新指针后才派发新版本。

## JSONL 示例

```jsonl
{"id":1,"method":"content.bundle.plan","params":{"projectRoot":"/absolute/2.4-project","creatorVersion":"2.4.15","releaseId":"bundle-release-01","bundleRoot":"assets/CocosAgentBundleSmoke","bundleName":"cocos-agent-smoke","entryAssetName":"BlueReleaseOct09.png","assets":[{"id":"red","assetName":"RedReleaseOct09.png"},{"id":"blue","assetName":"BlueReleaseOct09.png"}]}}
{"id":2,"method":"content.bundle.stage","params":{"projectRoot":"/absolute/2.4-project","creatorVersion":"2.4.15","releaseId":"bundle-release-01","bundleRoot":"assets/CocosAgentBundleSmoke","bundleName":"cocos-agent-smoke","entryAssetName":"BlueReleaseOct09.png","assets":[{"id":"red","assetName":"RedReleaseOct09.png"},{"id":"blue","assetName":"BlueReleaseOct09.png"}]}}
```

`content.bundle.plan/stage` 只接受 `creatorVersion: "2.4.15"`、`assets/<单级文件夹>` 与 1–16 张 PNG。文件夹 `.meta` 必须声明 `isBundle: true`、对应 `bundleName` 且不是 remote Bundle；PNG `.meta` 必须有与 Texture UUID 相连的单个 SpriteFrame UUID。源 PNG 变更后，选择、构建和运行时 Host 都会重新校验，旧 fingerprint 不再有效。

## 回执与观测字段

- `content.preview.get.buildReleaseId`：构建时绑定的 release。
- `selectedReleaseId`：此刻 Host 选择的 release。
- `effectiveReleaseId`：最近一次被接受的运行时 release。失败回执不会覆盖此值。
- `status: runtime-observed`：有认证客户端回执且 Host 接受其 selected release、资源 UUID 与有效状态。
- `status: needs-review` 和 `receipt.outcome: retained`：候选 Bundle 加载失败；旧画面和旧 effective 保持。修复问题后须通过显式选择产生新的 dispatch，不对同一失败请求自动重试。

## Creator 2.4.15 Web-Mobile 实机证据（2026-10-09）

release `bundle-host-web-20261009` 包含红蓝资源。隔离构建的 Bundle config SHA-256 为 `3bcfecacdbb409dd945276e941cf4e477e2d217abb8e4c2f6f3d5c443f090da0`。Host 核对了两份 native PNG、Texture/SpriteFrame UUID 和 import 依赖；浏览器显示蓝色运行时 Sprite，回执 `applied`、Texture UUID 匹配、引用数 1。

预览期间回滚至 `web-content-ui-2026-10-08` 后，内置 resources 纹理被应用并成为 effective。随后将该隔离构建的蓝色 native PNG 临时移出服务目录，再显式选择 Bundle release；浏览器资源请求返回 404，运行时返回 `retained`，截图仍显示旧资源，effective 未变。文件恢复后，先切换旧 release 再显式选择 Bundle，运行时重新 `applied`；最后回滚并确认 selected/effective 指针恢复旧 release。临时文件已恢复，预览服务与标签已关闭。逐事件记录见 [实机轨迹](traces/cocos-agent-asset-bundle-host-2.4-web.jsonl)。

## 未覆盖

尚未验证进程重启后的运行时重建、多 Bundle 并存的缓存计数与峰值内存、外置/远端 Bundle、下载缓存与版本 URL、小游戏、JSB、原生增量更新、任意资源类型或 Creator 3.8。`removeBundle` 与 `release/releaseAll` 的缓存区别有独立 Web 手册烟雾轨迹；Host 实机切换未直接读取内部 AssetManager 缓存计数。
