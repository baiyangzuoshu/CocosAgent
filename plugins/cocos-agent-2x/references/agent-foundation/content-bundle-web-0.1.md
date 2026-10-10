# Cocos Creator 2.4 Web-Mobile Asset Bundle 内容合同 0.1

本文记录 CocosAgent 对 Creator 2.4.15 本机 Web-Mobile Asset Bundle 的有限支持。它扩展现有 release/build/preview 合同，不代表 3.8、外置下载、远端发布、小游戏或原生热更新。

## 流程

1. `content.bundle.plan` 只读检查已由 Creator 导入的 PNG、Bundle 文件夹 `.meta`、本地 Bundle 名、源字节摘要、Texture UUID、唯一 SpriteFrame UUID 及 release 内的资源依赖图。`dependsOn` 只引用本 release 中的 asset ID。
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

两个 2.4.15 Bundle 共享同一 `resources` SpriteFrame 的正式构建和 Web-Mobile 运行时轨迹已补齐。config `deps/redirect` 将共享 UUID 归到 `resources`；两个场景读回同一个 SpriteFrame 对象和同一个源 Texture 对象。Smoke→Sidecar、Sidecar→Smoke 两种卸载顺序中，每次移除 Bundle 后共享 Frame/Texture 均有效并在 Asset Cache；四个首场景/卸载后场景截图均能看见红色 Sprite。Asset Cache 在该探针中从基线 29 保持到 29，释放探针持有后降至 27；Bundle Cache 为 3→5→3。详见 [共享依赖轨迹](traces/cocos-agent-shared-bundle-dependency-2.4-web.json) 与 [Asset Bundle 切片计划](cocos2-asset-bundle-slice-plan.md)。2.4.15 没有公开的 `SpriteFrame.texture` 属性：源纹理从 `frame._original._texture` 读取，当前渲染纹理 `frame._texture` 可以是动态合图对象，其 UUID 为空；本次另外核对了渲染纹理已加载、后端纹理对象存在和截图。该旧轨迹为观察自动依赖释放临时把 Scene 对象设为 `autoReleaseAssets=true`；新增边界探针则保留加载后的运行时 `false`，直接验证场景切换、活动 consumer 持有时 owner 的 `releaseUnusedAssets()` 保留资源，以及退出测试场景后的显式清理。详见[边界轨迹](traces/cocos-agent-shared-bundle-boundaries-2.4-web.json)和[截图](traces/visual/cocos-agent-shared-boundary-auto-release-false.png)。

0.1 清单中的 `dependsOn` 仍是 release 内部 asset ID 的依赖图，不表达跨 delivery 所有权。独立的跨 Bundle 合同 0.2 已加入 Host/MCP：从 PNG `.meta` 与 `.fire` 静态引用推导 owner/consumer，绑定目标 `buildId`，并在构建时验证唯一 owner、完整 UUID、Frame→Texture import、consumer scene UUID、`deps` 与 `redirect`。预览会把经验证合同传给 2.4 动态内容 runtime；owner-first acquire 和 Agent lease 的延迟释放已有模拟测试。合同实现及状态见[跨 Bundle 依赖合同 0.2](asset-bundle-cross-dependency-0.2-design.md)。

新增合同的本地 Creator CLI 构建尝试（buildId `cross-bundle-web-1010`）以 exit code 1 失败，未生成输出目录；失败回执见项目忽略数据 `.cocos-agent/content-builds/cross-bundle-web-1010.json`。因此没有新的浏览器端到端实机验收；旧共享依赖构建只读校验和模拟测试仍是独立证据。进程重启后的 Asset Bundle 运行时重建、多 Bundle 峰值内存、外置/远端 Bundle、下载缓存与版本 URL、小游戏、JSB、原生增量更新、任意资源类型或 Creator 3.8 仍未验证。`removeBundle` 与 `release/releaseAll` 的差异见官方手册和本地源码分析；运行时 owner Bundle 对象当前保留，不自动物理卸载。
