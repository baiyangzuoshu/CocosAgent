# Cocos Creator 2.4 Asset Bundle 切片计划

状态：Creator 2.4.15 Web-Mobile 本地 Asset Bundle 烟雾验收已完成；Host 合同与产品入口尚未实现。本文描述后续实现边界，不代表 CocosAgent 已提供 Bundle 发布能力。

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
- 当前 `tools/cocos-agent-bridge/content-release.schema.json` 只定义 `delivery: built-in-resources`，`content-release.js` 与 `CocosAgentContentRuntime.js` 也固定走 `cc.resources.load`。Asset Bundle 必须使用独立版本合同或显式扩展合同，不可把 `bundleName` 塞进现有 `runtimePath` 后假装兼容。
- 当前 PNG 导入和资源场景命令将目标限制在 `assets/resources/`。Bundle 文件夹导入、文件夹 `.meta` 配置和构建输出检查都需要明确的 2.4 适配器与能力声明。

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

上述结果只证明本机 Web-Mobile 包内 PNG Bundle 的构建、按需加载、Sprite 替换、缺失资源失败保留、Bundle 缓存移除与显式释放。没有 Host release/构建/预览合同，没有 CDN、外置 Bundle、小游戏、JSB、原生或 3.8 验收；页面探针构建用于确认引擎运行时 API，不是产品构建记录。完整轨迹见 `traces/cocos-agent-asset-bundle-smoke-2.4-web.jsonl`。

## 建议先跑的实机烟雾切片

1. 在隔离或明确标记的 2.4 示例资源目录配置一个自定义 Bundle；资源只使用两张独立副本 PNG，保留真实的 Texture 与 SpriteFrame 子资源关系。不得把 Bundle 放在已有 `resources` 根目录里，也不得更改该目录已有 bundle 设置。
2. 用 2.4.15 Creator 构建新的唯一 Web-Mobile 输出目录，核对 `assets/<bundleName>/` 下的 config、import 和 native 文件；从 config 与 `.meta` 读回每张图的路径、类型和 UUID。
3. 启动此构建，在运行时调用 `loadBundle(bundleName)` 与 `bundle.load(path, cc.SpriteFrame)`，核对返回对象 UUID、依赖关系、引用数和画面。失败路径加载一个缺失资源，确认当前画面与有效版本保留。
4. 成功替换后再释放旧 SpriteFrame 与 Bundle 资源，调用 `removeBundle` 后读回 Bundle 缓存和 Asset 缓存；单独记录 `release`、`releaseAll`、`removeBundle` 的效果。不要在资源仍被场景节点使用时做强制释放。
5. 生成只含版本/Bundle/资源身份的运行轨迹；记录 Creator 版本、平台、构建目录、Bundle 配置 hash、资源 UUID、回执和视觉观察。构建目录、会话 URL token 不写入公开 trace。

下一步开发 Host 入口。Bundle release 至少包含：`creatorVersion`、独立 `releaseId`、`bundleName`、Creator Bundle config hash、入口 `assetId`，以及逐资产的相对路径、资源 UUID、源摘要与明确依赖。首个 Agent 执行合同应分为只读 plan、隔离 build、包校验、preview/运行时应用、get/reconcile 与 rollback；每个版本用唯一 Bundle 名或独立输出 URL，以避开 2.4 同名 Bundle 的进程缓存命中。发布期间保留旧 Bundle 与其资源，等新 Bundle 资源通过 UUID 校验并完成一帧绘制后才切换和释放旧引用。

## 暂缓事项

首轮不制作通用跨资源类型 AssetDB 导入器，不写 Editor 私有 IPC，不覆盖脚本分包和场景分包，不宣称热更新/CDN/线上发布，不改 2.x 引擎源码，也不补 3.8。外置远程 Bundle、`version` hash 更新、下载缓存与 JSB 用户目录加载属于下一步独立切片，先等 Web 本地 Bundle 的构建与生命周期证据齐全。

## 验收完成条件

- Creator 2.4.15 真实生成的独立 Bundle 通过 package-level config/UUID/导入文件校验。
- Web-Mobile 构建真实加载 bundle 资源并显示；Host 读取到与声明一致的 bundle、release 和资源身份。
- 构造的 Bundle/资源加载失败不会覆盖有效画面；重复加载不会意外重复建立 Bundle 或多持有纹理。
- 成功替换后旧资源按引用关系释放，`removeBundle` 与资源释放效果分别读回；运行时重启后可通过持久 release 重新核对并恢复。
- 轨迹、合同和 2.4 专属候选 skill 将实际覆盖范围与未测分支分开记录。
