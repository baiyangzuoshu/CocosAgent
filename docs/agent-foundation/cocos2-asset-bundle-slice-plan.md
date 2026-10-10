# Cocos Creator 2.4 Asset Bundle 切片计划

状态：Creator 2.4.15 Web-Mobile 本地 Asset Bundle 的 Host release、隔离构建、包校验、运行时应用、失败保留、显式重选恢复和回滚已完成实机验收。范围仍限于 2.4.15 PNG Bundle 与本机 Web-Mobile，不代表远端、原生或 3.8 能力。

## 目标

在当前 2.4.15 示例中，把**一个带真实资源依赖的独立 Asset Bundle**作为可校验的内容交付单元：配置与导入 → Creator 构建 → 校验 Bundle 清单和导入产物 → 运行时按需加载 → 视觉替换 → 失败保留旧内容 → 释放与恢复。第一轮限定在 Web-Mobile 本机预览，不实现 CDN 发布、小游戏、JSB 热更新或 3.8。

## 官方手册校准

- 2.4 Asset Bundle 按文件夹配置；bundle 文件夹及其外部依赖会进入同一个 Bundle，构建输出包含资源文件与 `config.json`。读取 [Asset Bundle 介绍](https://docs.cocos.com/creator/2.4/manual/zh/asset-manager/bundle.html) 与[配置和加载 Asset Bundle](https://docs.cocos.com/creator/2.4/manual/zh/scripting/asset-bundle.html)。
- 引擎以 `cc.assetManager.loadBundle(nameOrUrl, options, callback)` 取得 Bundle 对象；加载 Bundle 时读取配置和其中脚本，并不等于把所有纹理都实例化。之后调用 `bundle.load(path, cc.SpriteFrame|cc.Texture2D, callback)` 读取目标资源。
- 2.4 手册指出 Creator 的“配置为远程包”选项不支持 Web。手册另有通过 URL 加载 Bundle 的 API 示例；两者是不同入口。本切片先用 Web-Mobile 包中的本地 `assets/<bundleName>/`，不把 URL 加载、远程部署或热更新写成验收能力。后续如验证外置 Web Bundle，再单独确认跨域、资源服务器地址和缓存行为。
- MD5 Cache 会生成带 hash 的 Bundle 配置文件名；`loadBundle` 可接收版本参数。此行为仍须结合本地引擎源码和真实构建输出验收，不能把 `releaseId` 直接等同于 Creator Bundle 文件 hash。
- 手册指出 `bundle.release/releaseAll` 会释放资源并处理依赖；`cc.assetManager.removeBundle` 只移除 Bundle 缓存，**不会**自动释放已加载资产。旧资产需要在新画面确认后再释放，故失败前不得先清理旧版本。

## 本地实现依据与边界

- `2.4.15engine/cocos2d/core/asset-manager/CCAssetManager.js`：`loadBundle` 先按 `basename(nameOrUrl)` 检查 Bundle 缓存，命中后直接返回缓存对象；不会用本次 `options.version` 替换已缓存的同名 Bundle。`removeBundle` 调用 `bundle._destroy()` 并从 Bundle 缓存删除，但引擎注释明确资源不会自动释放。
- `2.4.15engine/cocos2d/core/asset-manager/downloader.js`：非 URL 名称解析到 `assets/<bundleName>`；按 Bundle 版本请求 `config.<version>.json` 和 `index.<version>.js`。
- `2.4.15engine/cocos2d/core/asset-manager/bundle.js`：`release(path,type)` 通过 `releaseManager` 释放具体资产；`releaseAll()` 遍历属于此 Bundle 的资产并尝试释放。
- `content-release.schema.json` 现在通过显式的 `delivery: asset-bundle` 扩展合同表示 2.4 Bundle，并要求 `bundleRoot`、唯一 `bundleName`、源摘要、Texture UUID、SpriteFrame UUID 与依赖图；3.8 请求被拒绝。
- `content.bundle.plan/stage` 只读取已导入 PNG 与文件夹 `.meta`，检查本地 Bundle 身份与 UUID 链；不会导入资源或修改 Creator 场景。Host 在已有 release、build、preview 路径上复用所选版本、隔离输出和运行时回执合同。

## 2.4.15 Web-Mobile 烟雾验收（2026-10-09）

在 `2.4.15NewProject/assets/CocosAgentBundleSmoke/` 保留了一个独立 Bundle 夹具，不修改已有 `resources` Bundle。Creator 2.4.15 CLI 以 `platform=web-mobile`、`debug=false`、`md5Cache=true` 真实构建后，输出包含 `assets/cocos-agent-smoke/config.417c7.json`、Bundle index、两份 SpriteFrame/Texture import JSON 与两份 native PNG。Config SHA-256 为 `3bcfecacdbb409dd945276e941cf4e477e2d217abb8e4c2f6f3d5c443f090da0`。

| 资源 | Texture UUID | SpriteFrame UUID | 构建读回 |
| --- | --- | --- | --- |
| `RedReleaseOct09` | `cdc0901f-6059-4519-9abd-dff51521abea` | `69e2f032-7739-49aa-b9f0-6b6eb820984f` | native PNG、texture import 与 sprite-frame import 存在 |
| `BlueReleaseOct09` | `0a19c5a6-a415-4278-8d9c-12f98bfe1bc8` | `3f0ad80b-bafa-4818-a000-7dfeb8aa80f5` | native PNG、texture import 与 sprite-frame import 存在 |

临时运行时探针在构建时加入已有 `HelloWorld.js`，构建后即恢复；源文件恢复 SHA-256 为 `5d489ee56ff2397f74895df229a0ab06f7b74ed10ef57333d127be4e4120bb22`，`helloworld.fire` 未改。运行轨迹确认：

- `loadBundle("cocos-agent-smoke")` 返回并缓存同一 Bundle；`bundle.load("BlueReleaseOct09", cc.SpriteFrame)` 返回上述 SpriteFrame UUID。把它赋给左侧红色节点后，运行时字段读回为同一对象，Web 画面左侧由红变蓝。
- 请求缺失资源 `MissingFromBundleSmoke` 得到明确错误 `Bundle cocos-agent-smoke doesn't contain MissingFromBundleSmoke`；当前蓝色 SpriteFrame 保持同一对象，未被失败请求覆盖。
- 恢复旧画面后，`removeBundle` 清空 Bundle 缓存，但红、蓝 SpriteFrame 仍有效并留在 Asset 缓存。再次 `loadBundle` 返回新 Bundle 对象。
- `bundle.release("BlueReleaseOct09", cc.SpriteFrame)` 后，等待 100 ms 再读回，该 SpriteFrame 已无效且不在 Asset 缓存。`releaseAll()` 后，红色 Bundle SpriteFrame 也已无效并从缓存移除。释放前目标节点已恢复到 Bundle 外的场景资源。

上述结果证明本机 Web-Mobile 包内 PNG Bundle 的构建、按需加载、Sprite 替换、缺失资源失败保留、Bundle 缓存移除与显式释放。页面探针构建用于确认引擎 API，不是 Host 构建记录。完整轨迹见 `traces/cocos-agent-asset-bundle-smoke-2.4-web.jsonl`。

## Host 接入与运行时验收（2026-10-09）

Host 用 `content.bundle.plan/stage` 登记 `cocos-agent-smoke` 的红蓝 PNG，选中 `bundle-host-web-20261009`，再经 `content.build.plan/execute/get` 构建唯一输出。Creator 2.4.15 的包校验读回 config SHA-256 `3bcfecacdbb409dd945276e941cf4e477e2d217abb8e4c2f6f3d5c443f090da0`、两张纹理 UUID、两张 SpriteFrame UUID、Texture import、SpriteFrame import 依赖及 native PNG。

真实 `content.preview.start/get/stop` 会话中，运行时按 Bundle 名加载蓝色入口纹理并应用 SpriteFrame；Host 收到 `applied`、资源 UUID 匹配、引用数为 1 的回执并写入 `effective`。浏览器画面可见新蓝色覆盖图。将 selected 指针回滚至 `web-content-ui-2026-10-08` 后，运行时改载旧 `resources` release，收到第二个 `applied`，画面保留旧内容；preview 状态同时读回 `buildReleaseId`、当前 `selectedReleaseId` 和 `effectiveReleaseId`，三者不再混为一谈。

失败分支通过对运行中的隔离构建临时移走蓝色 Bundle native PNG 实测：显式重新选择 Bundle 后，加载返回 404，运行时回执为 `retained`，有效画面与 `effective` 仍是旧 `resources` release，preview 状态为 `needs-review`。恢复 PNG 后，Host 不会自动重试同一指纹；通过明确切回旧 release 再选择 Bundle 才重新应用成功，最后再次回滚并确认 selected/effective 都恢复到旧 release。构建文件在验收后恢复原位，预览服务和浏览器标签已关闭。轨迹见 `traces/cocos-agent-asset-bundle-host-2.4-web.jsonl`。

## 多 Bundle 并行驻留（2026-10-09）

按 [2.4 Asset Bundle 介绍手册](https://docs.cocos.com/creator/2.4/manual/zh/asset-manager/bundle.html)和[配置、加载与释放手册](https://docs.cocos.com/creator/2.4/manual/zh/scripting/asset-bundle.html)的按需加载方式，在示例增加独立 `cocos-agent-sidecar` PNG Bundle。`bundle-dual-residency-20261009` 实际 Web-Mobile 输出同时包含 `cocos-agent-smoke` 与 `cocos-agent-sidecar` 两个自定义包和 Creator 的三个内置 Bundle。无头浏览器先后两次同时加载两个唯一 Texture 并各自持有一个 `addRef()`；分别以 A→B 和 B→A 顺序 `decRef`、调用准确 Bundle 的 `release(path, cc.Texture2D)`、再 `removeBundle`。释放 A 后 B 的 Texture 仍有效、UUID 仍在 Asset Cache、B Bundle 仍在 Bundle Cache；反向顺序也成立。每次全部释放后，Asset Cache 和 Bundle Cache 都精确回到同一页面基线：29 个缓存资产、3 个内置 Bundle。逐次读回见[双 Bundle 并行驻留轨迹](traces/cocos-agent-multi-bundle-residency-2.4-web.json)；可重复脚本为 `probes/cocos-bundle-residency-2.4.mjs`。

该样本只证明两个**互不共享依赖**的 PNG Bundle 在当前 2.4.15 Web-Mobile 构建里可并行驻留、按各自 Bundle 释放且缓存回基线。随后已继续验证共享 `resources` 依赖，见下节。动态新增/替换两个 Bundle 的产品合同、帧耗时和内存预算仍未覆盖。官网指出不同优先级共享资源由较高优先级 Bundle 持有，低优先级 Bundle 加载前须先加载高优先级 Bundle；本次构建与运行时顺序验证见下节。

### 共享依赖正式导入、构建与运行时验收（2026-10-10）

Creator 2.4 官方[释放 Asset Bundle 手册](https://docs.cocos.com/creator/2.4/manual/zh/scripting/asset-bundle.html)说明 `releaseAll()` 会释放 Bundle 内资源及其外部相关依赖；[优先级手册](https://docs.cocos.com/creator/2.4/manual/zh/asset-manager/bundle.html)说明低优先级 Bundle 对高优先级共享资源保存重定向，并要求先加载高优先级 Bundle。对照本仓库 2.4.15 源码后，这两条描述需要结合资源根节点和引用路径理解：

- `2.4.15engine/cocos2d/core/asset-manager/bundle.js` 的 `releaseAll()` 遍历全局 Asset Cache，再查询当前 Bundle 的资源信息；当前 Bundle 将资源标为 `redirect` 时会跳过该缓存项。对于 Bundle 自有的缓存资源，`releaseManager.tryRelease(asset, true)` 会强制释放该根资源，并递归处理它的依赖；`releaseManager._free()` 对递归依赖执行 `decRef(false)` 与非强制释放，所以仍有其它引用的依赖不会因此被强制销毁。不要把“跳过重定向条目”泛化为“releaseAll 永不处理外部依赖”，也不要把官方的“包括外部相关依赖”泛化为“无视依赖引用强制销毁”。
- `bundle.js` 的 `loadScene()` 返回 `SceneAsset`，但 `2.4.15engine/cocos2d/core/asset-manager/utilities.js` 的 `cache()` 不把 SceneAsset 放进全局 Asset Cache。场景依赖的 SpriteFrame 会在反序列化时建立对象引用；运行中的场景切换则经过 `CCDirector.js` 的 `runSceneImmediate()` 和 `releaseManager._autoRelease()`，旧场景的 `autoReleaseAssets` 决定依赖 `decRef()` 是否触发释放尝试。因此场景 Bundle 的资源回收不能只用 `Bundle.releaseAll()` 推断，还要记录 Director 切场景时的引用变化。
- `2.4.15engine/cocos2d/core/asset-manager/urlTransformer.js` 在低优先级 Bundle 解析到尚未加载的高优先级依赖时返回“先加载依赖 Bundle”的错误。此次正向测试明确先加载 `resources`，再加载两个 consumer Bundle；**尚未把过早加载 consumer 的负向分支纳入成功证据**，不推广其错误表现。

Creator 2.4.15 通过 Agent 的 `asset.refreshFolder` 刷新 Smoke 与 Sidecar 夹具后，正式构建隔离 Web-Mobile 包 `shared-dependency-20261010-01`。两份场景 UUID 分别为 `d86b9b2f-5d52-43b3-b2c7-5e345f9960e4` 和 `53751717-051c-4b3d-abe7-19bfc2b3990a`；共享 PNG 的 Texture UUID 为 `bf8602ca-5561-4eb5-8c63-9653d4c32a4f`，SpriteFrame UUID 为 `0683b14a-8790-4ecd-9ee5-4b83163e34ff`，SpriteFrame `.meta` 的 `rawTextureUuid` 回指该 Texture。两个 Bundle config 的 SHA-256 分别为 `2e3b0a886ec3df7833eaa6ec35e2556bed5aeee22f5b49fc16b3da0eb6fe6b5`、`dd2f4c25b6f4e70bf25b45b21d44c1c87391d1ca072f265e1c0edb438f34eeaf`，都声明 `deps: ["resources", "internal"]`，并把共享 Frame UUID 重定向到 `resources`。配置、压缩 UUID、redirect 与场景关系见 [`共享依赖运行轨迹`](traces/cocos-agent-shared-bundle-dependency-2.4-web.json)。

Web-Mobile 探针按两个卸载顺序重复测试：Smoke→Sidecar、Sidecar→Smoke。两场景的 Sprite 反序列化得到同一个 SpriteFrame 对象；SpriteFrame 的原始纹理与 Asset Cache 中唯一的源 Texture 是同一对象。两侧场景都加载后，SpriteFrame `refCount=3`、Texture `refCount=2`。每次卸载一侧都调用对应 Bundle 的 `releaseAll()` 与 `removeBundle()`：其 Bundle 缓存被移除，另一 Bundle 仍在缓存；共享 Frame/Texture 均保持有效且仍在 Asset Cache。随后把另一已加载的场景运行起来，四个首/次序截图均显示红色 Sprite；即使第二个 Bundle 也已移除，已加载场景仍可见。切出两场景后 Frame 回到显式持有基线。Asset Cache 基线为 29，两个 Bundle 加载和卸载后仍为 29；释放探针持有的 Frame/Texture 后变为 27，两个 UUID 从缓存消失。Bundle Cache 为 3→5→3。

边界需同时保留：两个 `.fire.meta` 导入的 `autoReleaseAssets` 都是 `false`，探针为观察依赖引用下降，在运行时将已加载 Scene 对象该标记临时设为 `true`；因此没有验证源设置 `false` 时的切场景回收。2.4.15 的 `SpriteFrame` 没有公开 `texture` 属性。探针记录 `frame._original._texture` 为源 Texture，并记录 `frame._texture` 为动态合图参与渲染的当前纹理对象；后者 UUID 可为空，但已加载且有后端纹理对象。通过截图确认了四个检查点中的红色 Sprite 可见。这验证该构建、该 Web-Mobile 运行时和预加载 `resources` 的条件，不代表所有 Bundle 顺序、平台或资产配置。原始探针为 `probes/cocos-bundle-shared-dependency-2.4.mjs`。

### 资源依赖合同的下一版边界

当前 `content-release` 0.1 的每项 `dependsOn` 是**同一 release 内 asset ID 的有向无环图**。它不能表达 Bundle 场景中的 SpriteFrame 重定向到另一个交付 owner（本例为 built-in `resources`）这一条外部边，也不记录 owner 必须先加载的顺序。此次实测为下一版合同给出具体字段需求，但不应把实验性格式写成现有能力：

- 外部依赖边需绑定 consumer 场景 UUID 与 owner delivery/Bundle 名称。
- 资源身份至少同时包含 SpriteFrame UUID、Texture UUID，并验证 SpriteFrame `rawTextureUuid` 回指 Texture。
- 构建验收应读回 consumer Bundle `deps`、SpriteFrame `redirect`、压缩 UUID 和 owner 的实际资源映射。
- 运行时调度要显式表达 owner 先加载、consumer 后加载；卸载时保留跨 Bundle 引用仍在使用的 owner 资源，并回执逐步引用和缓存状态。
- 可见验收要记录源 Texture、可能的动态合图渲染纹理和截图，不能把空 UUID 当作没有纹理，也不能只凭 Asset Cache 命中宣称画面已显示。

候选字段草图（仅供 0.2 评审，不是当前 schema）：

```json
{
  "externalDependencies": [
    {
      "consumerSceneUuid": "d86b9b2f-5d52-43b3-b2c7-5e345f9960e4",
      "owner": { "delivery": "built-in-resources", "bundleName": "resources" },
      "asset": {
        "spriteFrameUuid": "0683b14a-8790-4ecd-9ee5-4b83163e34ff",
        "textureUuid": "bf8602ca-5561-4eb5-8c63-9653d4c32a4f"
      },
      "loadPolicy": "owner-before-consumer"
    }
  ]
}
```

在实现 0.2 前，还要实测 consumer 在 `resources` 未加载时的拒绝分支，并验证源 `.fire.meta` 的 `autoReleaseAssets=false` 场景切换行为。0.1 的 `dependsOn` 继续只表示 release 内关系。

为消除新生成目录必须手动点选导入的步骤，2.4 扩展/Host/MCP 已加入 `asset.refreshFolder`：它只接受已存在的 `assets/` 相对目录，拒绝 traversal 和路径中的符号链接，调用官方 `Editor.assetdb.refresh`，并将结果限制为最多 16 条不含绝对路径的变更记录。Schema、MCP 路由、目录合同和 Host WebSocket 协议模拟测试通过。2026-10-09 对运行中的 Creator 执行只读 `capabilities.list`，实际扩展版本为 `0.1.0`，仅返回原有 9 条命令且缺少 `asset.refreshFolder`；因此能力目录被新 Host 拒绝，尚未执行 AssetDB 刷新。原始只读回执见[扩展目录轨迹](traces/cocos-agent-asset-refresh-folder-catalog-2.4.jsonl)。当前 Mac 锁屏，无法在编辑器中重载扩展；这不是 AssetDB 实机证据。

**后续缺口：** consumer 未预加载高优先级 `resources` 时的实际错误与恢复；源 `.fire.meta` 为 `autoReleaseAssets=false` 时的切场景回收；把跨 delivery 资源 owner、UUID 链、构建 redirect 与运行时加载次序纳入未来 release 合同。不能把 0.1 的内部 `dependsOn` 当成已实现的跨 Bundle 依赖。

## 暂缓事项

首轮不制作通用跨资源类型 AssetDB 导入器，不写 Editor 私有 IPC，不覆盖脚本分包和场景分包，不宣称热更新/CDN/线上发布，不改 2.x 引擎源码，也不补 3.8。外置远程 Bundle、`version` hash 更新、下载缓存与 JSB 用户目录加载属于后续独立切片；本地 Bundle 已验收，不代表这些分发路径已具备。

## 验收完成条件

- Creator 2.4.15 实际构建通过 Bundle config、资源 UUID、SpriteFrame 依赖和文件校验；Host release 选择、运行时 applied、effective、视觉观察、缺失资源 retained、显式重选和 rollback 均已实测。
- 单元测试验证不同 Bundle 替换在新帧确认后清理旧 Bundle、候选失败时保留当前 SpriteFrame，以及 3.8 拒绝 Bundle 合同；实际预览另验证 Bundle 与 built-in-resources 双向切换。
- 2026-10-09 的 2.4 Web-Mobile 实测将 Bundle → built-in resources → Bundle 往返两轮。旧 Texture 清理后均读回 `refCount=0`、`valid=false`、Asset Cache 不含 UUID；Asset Cache 数稳定为 30，Bundle Cache 在不含/含 `cocos-agent-smoke` 时分别为 3/4。Bundle Texture 在零引用且 UUID 匹配时显式 `bundle.release`，不为零时跳过强制释放；缓存与引用计数轨迹见 `traces/cocos-agent-content-runtime-diagnostics-2.4-web.jsonl`。
- 双独立 Bundle 并行驻留与双向卸载顺序已验证；共享 `resources` SpriteFrame 的构建 redirect、源 Texture 身份、两种 `releaseAll/removeBundle` 顺序和四个可见截图也已有 Web-Mobile 轨迹。`autoReleaseAssets=false` 的切场景回收、未预加载 owner 的拒绝分支、Asset Bundle 进程重启恢复、逐帧耗时及峰值内存尚未验收。外置/远端下载、CDN、小游戏、JSB、原生增量更新或其他资源类型仍是后续独立切片。
