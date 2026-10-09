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

该样本只证明两个**互不共享依赖**的 PNG Bundle 在当前 2.4.15 Web-Mobile 构建里可并行驻留、按各自 Bundle 释放且缓存回基线。尚未验证多个 Bundle 引用同一资源、不同优先级依赖、`releaseAll` 的跨 Bundle 影响、动态新增/替换两个 Bundle 的产品合同、帧耗时或内存预算。官网指出不同优先级共享资源由较高优先级 Bundle 持有，低优先级 Bundle 加载前须先加载高优先级 Bundle；下一试验将用两个 Bundle 内的场景依赖同一 `resources` SpriteFrame，观察依赖引用与卸载顺序。

## 暂缓事项

首轮不制作通用跨资源类型 AssetDB 导入器，不写 Editor 私有 IPC，不覆盖脚本分包和场景分包，不宣称热更新/CDN/线上发布，不改 2.x 引擎源码，也不补 3.8。外置远程 Bundle、`version` hash 更新、下载缓存与 JSB 用户目录加载属于后续独立切片；本地 Bundle 已验收，不代表这些分发路径已具备。

## 验收完成条件

- Creator 2.4.15 实际构建通过 Bundle config、资源 UUID、SpriteFrame 依赖和文件校验；Host release 选择、运行时 applied、effective、视觉观察、缺失资源 retained、显式重选和 rollback 均已实测。
- 单元测试验证不同 Bundle 替换在新帧确认后清理旧 Bundle、候选失败时保留当前 SpriteFrame，以及 3.8 拒绝 Bundle 合同；实际预览另验证 Bundle 与 built-in-resources 双向切换。
- 2026-10-09 的 2.4 Web-Mobile 实测将 Bundle → built-in resources → Bundle 往返两轮。旧 Texture 清理后均读回 `refCount=0`、`valid=false`、Asset Cache 不含 UUID；Asset Cache 数稳定为 30，Bundle Cache 在不含/含 `cocos-agent-smoke` 时分别为 3/4。Bundle Texture 在零引用且 UUID 匹配时显式 `bundle.release`，不为零时跳过强制释放；缓存与引用计数轨迹见 `traces/cocos-agent-content-runtime-diagnostics-2.4-web.jsonl`。
- 同日双独立 Bundle 并行驻留和双向卸载顺序已在构建包中重复验证，缓存计数 29/3 → 31/5 → 29/3；释放一个 Bundle 后另一个 Texture 与 Bundle 保持有效。共享依赖、不同优先级和 `releaseAll` 影响仍待单独实测，见本计划的“多 Bundle 并行驻留”与 `traces/cocos-agent-multi-bundle-residency-2.4-web.json`。
- 内置 `resources` release 已在 `web-host-cli-01` 实际 Web-Mobile 预览中验证 JSONL Host 重启后从持久 build/release 记录重建会话，并在重新打开新 URL 后重新应用资源；详见 `content-preview-web-0.1.md`。Asset Bundle 自身的 Host/运行时进程重启恢复、共享依赖释放、逐帧耗时与峰值内存尚未验收。无共享依赖的双 Bundle 同时驻留和双向卸载已验证。外置/远端下载、CDN、小游戏、JSB、原生增量更新或其他资源类型仍是后续独立切片。
